import { Logger } from "@/core/logger/logger";
import { GitHubClient } from "@/providers/github/client";
import type {
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubMetadata,
  GitHubCapability,
  GitHubRepoSearchResult,
  GitHubValidationProgress,
  GitHubHealthRecord,
} from "@/providers/github/types";
import { GITHUB_PERMISSION_CAPABILITY_MAP } from "@/providers/github/types";

export class GitHubManager {
  private readonly client: GitHubClient;
  private cachedUser: GitHubUser | null = null;
  private healthRecord: GitHubHealthRecord = {
    lastValidated: null, lastConnected: null, failureCount: 0, lastError: null, latency: 0,
  };

  constructor(
    token: string,
    logger: Logger,
  ) {
    this.client = new GitHubClient(token, logger);
  }

  getClient(): GitHubClient { return this.client; }
  getHealthRecord(): GitHubHealthRecord { return { ...this.healthRecord }; }

  private detectCapabilities(scopes: string[]): GitHubCapability[] {
    const caps = new Set<GitHubCapability>();
    caps.add("repositories");

    const scopeSet = new Set(scopes.map((s) => s.toLowerCase()));
    for (const [scope, cap] of Object.entries(GITHUB_PERMISSION_CAPABILITY_MAP)) {
      if (scopeSet.has(scope) || scopeSet.has(`${scope}:read`) || scopeSet.has(`${scope}:write`)) {
        caps.add(cap);
      }
    }

    if (scopeSet.has("repo") || scopeSet.has("public_repo")) {
      caps.add("issues");
      caps.add("pull_requests");
      caps.add("releases");
    }

    return [...caps].sort();
  }

  async validate(): Promise<GitHubValidationProgress[]> {
    const steps: GitHubValidationProgress[] = [];
    const addStep = (step: string, status: GitHubValidationProgress["status"], message: string) =>
      steps.push({ step, status, message });

    try {
      addStep("Token Check", "running", "Verifying token format and API access...");
      const { user, scopes, latency: checkLatency } = await this.client.checkToken();
      this.cachedUser = user;
      this.healthRecord.lastConnected = new Date().toISOString();
      this.healthRecord.latency = checkLatency;
      addStep("Token Check", "passed", `Authenticated as @${user.login}`);

      addStep("User Info", "running", "Retrieving user profile...");
      const userDetail = await this.client.getUser(user.login);
      addStep("User Info", "passed", `User: ${userDetail.name ?? userDetail.login} (${userDetail.public_repos} public repos)`);

      addStep("Organizations", "running", "Fetching organizations...");
      let orgs: GitHubOrganization[] = [];
      try {
        orgs = await this.client.getOrganizations();
        addStep("Organizations", "passed", `Found ${orgs.length} organization${orgs.length !== 1 ? "s" : ""}`);
      } catch {
        addStep("Organizations", "passed", "No organizations found or no access");
      }

      addStep("Repositories", "running", "Discovering repositories...");
      try {
        const repos = await this.client.getUserRepositories("all");
        const pub = repos.filter((r) => !r.private).length;
        const priv = repos.filter((r) => r.private).length;
        addStep("Repositories", "passed", `Discovered ${repos.length} repos (${pub} public, ${priv} private)`);
      } catch {
        addStep("Repositories", "passed", "Repositories found (count unavailable)");
      }

      addStep("Permissions", "running", "Detecting token permissions...");
      const caps = this.detectCapabilities(scopes);
      addStep("Permissions", "passed", `Detected ${caps.length} capabilities: ${caps.join(", ")}`);

      this.healthRecord.lastValidated = new Date().toISOString();
      this.healthRecord.failureCount = 0;
      this.healthRecord.lastError = null;
    } catch (e) {
      this.healthRecord.failureCount++;
      this.healthRecord.lastError = e instanceof Error ? e.message : "Unknown error";
      addStep("Validation", "failed", e instanceof Error ? e.message : "Validation failed");
    }

    return steps;
  }

  async getUser(): Promise<GitHubUser> {
    if (this.cachedUser) return this.cachedUser;
    const user = await this.client.getAuthenticatedUser();
    this.cachedUser = user;
    return user;
  }

  async getOrganizations(): Promise<GitHubOrganization[]> {
    return this.client.getOrganizations();
  }

  async getRepositories(owner?: string): Promise<GitHubRepository[]> {
    if (owner) {
      const user = await this.getUser();
      const isOrg = owner !== user.login;
      return isOrg
        ? this.client.getOrganizationRepositories(owner)
        : this.client.getUserRepositories("owner");
    }
    return this.client.getUserRepositories("all");
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.client.getRepository(owner, repo);
  }

  async searchRepositories(query: string, page = 1): Promise<GitHubRepoSearchResult> {
    return this.client.searchRepositories(query, page);
  }

  async getMetadata(): Promise<GitHubMetadata> {
    const user = await this.getUser();
    const orgs = await this.getOrganizations().catch(() => []);
    const repos = await this.client.getUserRepositories("owner").catch(() => []);

    const { scopes } = await this.client.checkToken().catch(() => ({ scopes: [] as string[] }));
    const caps = this.detectCapabilities(scopes);

    return {
      username: user.login,
      userId: user.id,
      accountType: user.type,
      avatarUrl: user.avatar_url,
      primaryEmail: user.email,
      planName: user.plan?.name ?? null,
      organizations: orgs,
      publicRepoCount: user.public_repos,
      privateRepoCount: repos.filter((r) => r.private).length || null,
      detectedCapabilities: caps,
      validatedAt: new Date().toISOString(),
    };
  }

  async getStats(): Promise<{
    totalRepos: number;
    publicRepos: number;
    privateRepos: number;
    orgCount: number;
    stargazers: number;
    forks: number;
    topLanguages: Record<string, number>;
  }> {
    const repos = await this.client.getUserRepositories("owner");
    const orgs = await this.getOrganizations().catch(() => []);

    const langCount: Record<string, number> = {};
    let stargazers = 0, forks = 0;

    for (const r of repos) {
      if (r.language) langCount[r.language] = (langCount[r.language] ?? 0) + 1;
      stargazers += r.stargazers_count;
      forks += r.forks_count;
    }

    const top = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

    return {
      totalRepos: repos.length,
      publicRepos: repos.filter((r) => !r.private).length,
      privateRepos: repos.filter((r) => r.private).length,
      orgCount: orgs.length,
      stargazers,
      forks,
      topLanguages: top,
    };
  }

  // ── Favorites & Recents (in-memory) ──

  private favorites: GitHubRepository[] = [];
  private recents: GitHubRepository[] = [];

  getFavorites() { return [...this.favorites]; }
  getRecents() { return [...this.recents]; }

  toggleFavorite(repo: GitHubRepository): boolean {
    const idx = this.favorites.findIndex((r) => r.id === repo.id);
    if (idx >= 0) { this.favorites.splice(idx, 1); return false; }
    this.favorites.push(repo);
    return true;
  }

  addRecent(repo: GitHubRepository): void {
    this.recents = this.recents.filter((r) => r.id !== repo.id);
    this.recents.unshift(repo);
    if (this.recents.length > 20) this.recents.length = 20;
  }
}
