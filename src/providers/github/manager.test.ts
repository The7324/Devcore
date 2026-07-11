import { describe, it, expect, vi } from "vitest";
import { GitHubManager } from "@/providers/github/manager";
import { Logger } from "@/core/logger/logger";

function fakeLogger() {
  return new Logger({ logLevel: "silent" } as any);
}

function makeManager(clientStub: Record<string, any>) {
  const manager = new GitHubManager("fake-token", fakeLogger());
  (manager as any).client = clientStub;
  return manager;
}

const sampleRepo = {
  id: 1,
  name: "repo1",
  full_name: "owner/repo1",
  private: false,
  description: "Test repo",
  stargazers_count: 5,
  forks_count: 2,
  open_issues_count: 1,
  language: "TypeScript",
  size: 100,
  default_branch: "main",
  html_url: "https://github.com/owner/repo1",
  homepage: null, disabled: false,
  topics: ["typescript"],
  fork: false,
  archived: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
  pushed_at: "2024-06-01T00:00:00Z",
  owner: { login: "owner", id: 1, avatar_url: "", html_url: "" },
  license: { key: "mit", name: "MIT", spdx_id: "MIT", url: "", node_id: "" },
  permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
  visibility: "public",
  has_issues: true,
  has_projects: true,
  has_downloads: true,
  has_wiki: true,
  has_pages: false,
  has_discussions: false,
  forks: 2,
  open_issues: 1,
  watchers: 5,
  watchers_count: 5,
  allow_forking: true,
  is_template: false,
  web_commit_signoff_required: false,
  svn_url: "",
  clone_url: "",
  ssh_url: "",
  git_url: "",
  mirror_url: null,
  node_id: "1",
  url: "",
  forks_url: "",
  keys_url: "",
  collaborators_url: "",
  teams_url: "",
  hooks_url: "",
  issue_events_url: "",
  events_url: "",
  assignees_url: "",
  branches_url: "",
  tags_url: "",
  blobs_url: "",
  git_tags_url: "",
  git_refs_url: "",
  trees_url: "",
  statuses_url: "",
  languages_url: "",
  stargazers_url: "",
  contributors_url: "",
  subscribers_url: "",
  subscription_url: "",
  commits_url: "",
  git_commits_url: "",
  comments_url: "",
  issue_comment_url: "",
  contents_url: "",
  compare_url: "",
  merges_url: "",
  archive_url: "",
  downloads_url: "",
  issues_url: "",
  pulls_url: "",
  milestones_url: "",
  notifications_url: "",
  labels_url: "",
  releases_url: "",
  deployments_url: "",
};

const sampleUser = {
  login: "testuser",
  id: 1,
  node_id: "",
  avatar_url: "",
  gravatar_id: null,
  url: "",
  html_url: "",
  followers_url: "",
  following_url: "",
  gists_url: "",
  starred_url: "",
  subscriptions_url: "",
  organizations_url: "",
  repos_url: "",
  events_url: "",
  received_events_url: "",
  type: "User" as const,
  site_admin: false,
  name: "Test User",
  company: null,
  blog: null,
  location: null,
  email: "test@user.com",
  hireable: null,
  bio: null,
  twitter_username: null,
  public_repos: 5,
  public_gists: 0,
  followers: 10,
  following: 5,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
};

describe("GitHubManager", () => {
  describe("getUser", () => {
    it("returns authenticated user", async () => {
      const m = makeManager({ getAuthenticatedUser: vi.fn().mockResolvedValue(sampleUser) });
      const user = await m.getUser();
      expect(user.login).toBe("testuser");
    });

    it("caches user after first call", async () => {
      const fn = vi.fn().mockResolvedValue(sampleUser);
      const m = makeManager({ getAuthenticatedUser: fn });
      await m.getUser();
      await m.getUser();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOrganizations", () => {
    it("returns organizations", async () => {
      const m = makeManager({ getOrganizations: vi.fn().mockResolvedValue([{ login: "org1" }]) });
      const orgs = await m.getOrganizations();
      expect(orgs).toHaveLength(1);
    });
  });

  describe("getRepositories", () => {
    it("returns user repos when no owner", async () => {
      const m = makeManager({
        getAuthenticatedUser: vi.fn().mockResolvedValue(sampleUser),
        getUserRepositories: vi.fn().mockResolvedValue([sampleRepo]),
      });
      const repos = await m.getRepositories();
      expect(repos).toHaveLength(1);
    });

    it("returns org repos when owner differs", async () => {
      const m = makeManager({
        getAuthenticatedUser: vi.fn().mockResolvedValue(sampleUser),
        getOrganizationRepositories: vi.fn().mockResolvedValue([sampleRepo]),
      });
      const repos = await m.getRepositories("someorg");
      expect(repos).toHaveLength(1);
    });
  });

  describe("getRepository", () => {
    it("returns single repo", async () => {
      const m = makeManager({ getRepository: vi.fn().mockResolvedValue(sampleRepo) });
      const repo = await m.getRepository("owner", "repo1");
      expect(repo.full_name).toBe("owner/repo1");
    });
  });

  describe("searchRepositories", () => {
    it("returns search results", async () => {
      const m = makeManager({ searchRepositories: vi.fn().mockResolvedValue({ items: [sampleRepo], totalCount: 1, incompleteResults: false }) });
      const result = await m.searchRepositories("test");
      expect(result.items).toHaveLength(1);
    });
  });

  describe("getMetadata", () => {
    it("returns metadata", async () => {
      const m = makeManager({
        getAuthenticatedUser: vi.fn().mockResolvedValue(sampleUser),
        getOrganizations: vi.fn().mockResolvedValue([]),
        getUserRepositories: vi.fn().mockResolvedValue([sampleRepo]),
        checkToken: vi.fn().mockResolvedValue({ scopes: ["repo", "user"] }),
      });
      const meta = await m.getMetadata();
      expect(meta.username).toBe("testuser");
      expect(meta.publicRepoCount).toBe(5);
      expect(meta.detectedCapabilities).toContain("repositories");
      expect(meta.detectedCapabilities).toContain("issues");
    });
  });

  describe("getStats", () => {
    it("computes stats", async () => {
      const m = makeManager({
        getAuthenticatedUser: vi.fn().mockResolvedValue(sampleUser),
        getUserRepositories: vi.fn().mockResolvedValue([sampleRepo, { ...sampleRepo, id: 2, private: true, language: "Rust", stargazers_count: 3, forks_count: 1 }]),
        getOrganizations: vi.fn().mockResolvedValue([]),
      });
      const stats = await m.getStats();
      expect(stats.totalRepos).toBe(2);
      expect(stats.publicRepos).toBe(1);
      expect(stats.privateRepos).toBe(1);
      expect(stats.topLanguages).toHaveProperty("TypeScript");
      expect(stats.topLanguages).toHaveProperty("Rust");
      expect(stats.stargazers).toBe(8);
    });
  });

  describe("validate", () => {
    it("runs validation steps", async () => {
      const m = makeManager({
        checkToken: vi.fn().mockResolvedValue({ user: sampleUser, scopes: ["repo", "user"], latency: 100 }),
        getUser: vi.fn().mockResolvedValue(sampleUser),
        getOrganizations: vi.fn().mockResolvedValue([]),
        getUserRepositories: vi.fn().mockResolvedValue([sampleRepo]),
      });
      const steps = await m.validate();
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1]!.status).toBe("passed");
    });

    it("handles validation failure", async () => {
      const m = makeManager({ checkToken: vi.fn().mockRejectedValue(new Error("Invalid token")) });
      const steps = await m.validate();
      expect(steps.some((s) => s.status === "failed")).toBe(true);
    });
  });

  describe("favorites & recents", () => {
    it("toggles favorites", () => {
      const m = makeManager({});
      expect(m.toggleFavorite(sampleRepo)).toBe(true);
      expect(m.getFavorites()).toHaveLength(1);
      expect(m.toggleFavorite(sampleRepo)).toBe(false);
      expect(m.getFavorites()).toHaveLength(0);
    });

    it("adds recents", () => {
      const m = makeManager({});
      m.addRecent(sampleRepo);
      expect(m.getRecents()).toHaveLength(1);
    });
  });
});
