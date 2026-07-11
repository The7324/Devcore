import { Logger } from "@/core/logger/logger";
import type {
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubRepoSearchResult,
  GitHubRateLimit,
} from "@/providers/github/types";

const API_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    _logger?: Logger,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; latency: number }> {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const start = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DevCore/0.1.0",
          ...(options.headers as Record<string, string>),
        },
      });
    } catch (e) {
      throw new GitHubApiError(`Network error: ${e instanceof Error ? e.message : "unknown"}`, 0);
    }

    const latency = Date.now() - start;
    const bodyText = await response.text();

    if (!response.ok) {
      let errBody: { message?: string; code?: string } | undefined;
      try { errBody = JSON.parse(bodyText); } catch { /* ignore */ }
      const msg = errBody?.message ?? bodyText.slice(0, 200) ?? `HTTP ${response.status}`;
      const ghCode = errBody?.code;
      throw new GitHubApiError(msg, response.status, ghCode);
    }

    const data: T = JSON.parse(bodyText);
    return { data, latency };
  }

  private async paginatedRequest<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 10) {
      const sep = path.includes("?") ? "&" : "?";
      const { data } = await this.request<T[]>(`${path}${sep}per_page=100&page=${page}`);
      results.push(...data);
      hasMore = data.length === 100;
      page++;
    }
    return results;
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    const { data } = await this.request<GitHubUser>("/user");
    return data;
  }

  async getUser(username: string): Promise<GitHubUser> {
    const { data } = await this.request<GitHubUser>(`/users/${username}`);
    return data;
  }

  async getOrganizations(): Promise<GitHubOrganization[]> {
    return this.paginatedRequest<GitHubOrganization>("/user/orgs");
  }

  async getOrganizationRepositories(org: string, type: "all" | "public" | "private" = "all"): Promise<GitHubRepository[]> {
    return this.paginatedRequest<GitHubRepository>(`/orgs/${org}/repos?type=${type}`);
  }

  async getUserRepositories(type: "all" | "owner" | "public" | "private" | "member" = "all"): Promise<GitHubRepository[]> {
    return this.paginatedRequest<GitHubRepository>(`/user/repos?type=${type}`);
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const { data } = await this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
    return data;
  }

  async searchRepositories(query: string, page = 1, perPage = 30): Promise<GitHubRepoSearchResult> {
    const { data } = await this.request<{ items: GitHubRepository[]; total_count: number; incomplete_results: boolean }>(
      `/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`,
    );
    return { items: data.items, totalCount: data.total_count, incompleteResults: data.incomplete_results };
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    const { data } = await this.request<GitHubRateLimit>("/rate_limit");
    return data;
  }

  async checkToken(): Promise<{ user: GitHubUser; scopes: string[]; latency: number }> {
    const url = `${API_BASE}/user`;
    const start = Date.now();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DevCore/0.1.0",
      },
    });
    const latency = Date.now() - start;

    if (!response.ok) {
    const msg = response.status === 401
        ? "Invalid or expired token"
        : response.status === 403
          ? "Token lacks permission"
          : `HTTP ${response.status}`;
      throw new GitHubApiError(msg, response.status);
    }

    const user: GitHubUser = await response.json();
    const scopes = (response.headers.get("X-OAuth-Scopes") ?? "").split(", ").filter(Boolean);
    return { user, scopes, latency };
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.request<{}>("/");
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }

  async getOrgRepositoriesByName(org: string, nameQuery: string): Promise<GitHubRepository[]> {
    const all = await this.getOrganizationRepositories(org);
    const lower = nameQuery.toLowerCase();
    return all.filter((r) => r.name.toLowerCase().includes(lower) || r.full_name.toLowerCase().includes(lower));
  }
}
