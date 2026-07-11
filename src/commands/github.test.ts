import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramContext, TelegramCallbackQuery } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import type { GitHubManager } from "@/providers/github/manager";
import { createGitHubCommand } from "@/commands/github";
import { GitHubProviderPlugin } from "@/providers/github/plugin";

function mockCtx(overrides: Partial<TelegramContext> = {}): TelegramContext {
  return {
    update: {} as any,
    user: { id: 1, is_bot: false, first_name: "Test" },
    chat: { id: 1, type: "private" },
    message: undefined,
    callbackQuery: undefined,
    commandArgs: [],
    botToken: "bot:token",
    replyText: vi.fn(),
    replyMarkdown: vi.fn(),
    replyHTML: vi.fn(),
    replyPhoto: vi.fn(),
    replyDocument: vi.fn(),
    replyKeyboard: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    answerCallback: vi.fn(),
    sendTyping: vi.fn(),
    ...overrides,
  };
}

function mockGh(): GitHubManager {
  return {
    getUser: vi.fn(),
    getOrganizations: vi.fn(),
    getRepositories: vi.fn(),
    getRepository: vi.fn(),
    searchRepositories: vi.fn(),
    getMetadata: vi.fn(),
    getStats: vi.fn(),
    validate: vi.fn(),
    getHealthRecord: vi.fn(),
    getClient: vi.fn(),
    getFavorites: vi.fn(),
    getRecents: vi.fn(),
    toggleFavorite: vi.fn(),
    addRecent: vi.fn(),
  } as unknown as GitHubManager;
}

function mockLayer(gh: GitHubManager): ConnectionsLayer {
  const conn = { id: "c1", provider: "GitHub", health: "healthy" as const, name: "test", encryptedCredentials: "enc" };
  const fakeProvider = Object.setPrototypeOf(
    { createManager: vi.fn().mockReturnValue(gh) },
    GitHubProviderPlugin.prototype,
  );
  (fakeProvider as any).constructor = GitHubProviderPlugin;
  return {
    manager: {
      getActiveConnection: vi.fn().mockReturnValue(conn),
    } as any,
    providerRegistry: {
      get: vi.fn().mockReturnValue(fakeProvider),
    } as any,
    credentialManager: {
      decryptCredentials: vi.fn().mockResolvedValue({ accessToken: "ghp_test" }),
    } as any,
  } as unknown as ConnectionsLayer;
}

describe("github command", () => {
  let gh: GitHubManager;
  let cmd: ReturnType<typeof createGitHubCommand>;

  beforeEach(() => {
    gh = mockGh();
    cmd = createGitHubCommand(mockLayer(gh));
  });

  it("status shows account info", async () => {
    vi.mocked(gh.getMetadata!).mockResolvedValue({
      username: "testuser", userId: 1, accountType: "User", avatarUrl: "", primaryEmail: "a@b.com",
      planName: "free", organizations: [], publicRepoCount: 5, privateRepoCount: 2,
      detectedCapabilities: ["repositories", "issues"], validatedAt: new Date().toISOString(),
    });
    vi.mocked(gh.getHealthRecord!).mockReturnValue({ lastValidated: null, lastConnected: null, failureCount: 0, lastError: null, latency: 50 });
    const ctx = mockCtx();
    await cmd.handle(ctx);
    expect(ctx.sendTyping).toHaveBeenCalled();
    expect(ctx.replyMarkdown).toHaveBeenCalledWith(expect.stringContaining("testuser"), expect.any(Object));
  });

  it("list repos", async () => {
    vi.mocked(gh.getMetadata!).mockResolvedValue({
      username: "testuser", userId: 1, accountType: "User", avatarUrl: "", primaryEmail: null,
      planName: null, organizations: [], publicRepoCount: 1, privateRepoCount: 0,
      detectedCapabilities: ["repositories"], validatedAt: new Date().toISOString(),
    });
    vi.mocked(gh.getRepositories!).mockResolvedValue([{
      id: 1, name: "repo1", full_name: "testuser/repo1", private: false,       description: "Test", stargazers_count: 0, forks_count: 0, open_issues_count: 0, language: "TS", size: 100,
      default_branch: "main", html_url: "", homepage: null, disabled: false, topics: [], fork: false, archived: false,
      created_at: "", updated_at: "", pushed_at: "",
      owner: { login: "testuser", id: 1, avatar_url: "", html_url: "" },
      license: null, permissions: undefined, visibility: "public",
      has_issues: false, has_projects: false, has_downloads: false, has_wiki: false, has_pages: false, has_discussions: false,
      forks: 0, open_issues: 0, watchers: 0, watchers_count: 0, allow_forking: true, is_template: false, web_commit_signoff_required: false,
      svn_url: "", clone_url: "", ssh_url: "", git_url: "", mirror_url: null, node_id: "1",
      url: "", forks_url: "", keys_url: "", collaborators_url: "", teams_url: "", hooks_url: "",
      issue_events_url: "", events_url: "", assignees_url: "", branches_url: "", tags_url: "",
      blobs_url: "", git_tags_url: "", git_refs_url: "", trees_url: "", statuses_url: "",
      languages_url: "", stargazers_url: "", contributors_url: "", subscribers_url: "",
      subscription_url: "", commits_url: "", git_commits_url: "", comments_url: "",
      issue_comment_url: "", contents_url: "", compare_url: "", merges_url: "", archive_url: "",
      downloads_url: "", issues_url: "", pulls_url: "", milestones_url: "", notifications_url: "",
      labels_url: "", releases_url: "", deployments_url: "",
    }]);
    const ctx = mockCtx({ commandArgs: ["repos"] });
    await cmd.handle(ctx);
    expect(gh.getRepositories).toHaveBeenCalled();
    expect(ctx.replyMarkdown).toHaveBeenCalledWith(expect.stringContaining("repo1"), expect.any(Object));
  });

  it("search repos", async () => {
    vi.mocked(gh.searchRepositories!).mockResolvedValue({ items: [{ full_name: "a/b" } as any], totalCount: 1, incompleteResults: false });
    const ctx = mockCtx({ commandArgs: ["search", "test"] });
    await cmd.handle(ctx);
    expect(gh.searchRepositories).toHaveBeenCalledWith("test");
  });

  it("info", async () => {
    vi.mocked(gh.getMetadata!).mockResolvedValue({
      username: "testuser", userId: 1, accountType: "User", avatarUrl: "", primaryEmail: null,
      planName: null, organizations: [], publicRepoCount: 5, privateRepoCount: 0,
      detectedCapabilities: ["repositories"], validatedAt: new Date().toISOString(),
    });
    vi.mocked(gh.getHealthRecord!).mockReturnValue({ lastValidated: null, lastConnected: null, failureCount: 0, lastError: null, latency: 0 });
    const ctx = mockCtx({ commandArgs: ["info"] });
    await cmd.handle(ctx);
    expect(ctx.replyMarkdown).toHaveBeenCalledWith(expect.stringContaining("testuser"), expect.any(Object));
  });

  it("stats", async () => {
    vi.mocked(gh.getStats!).mockResolvedValue({ totalRepos: 10, publicRepos: 7, privateRepos: 3, orgCount: 2, stargazers: 50, forks: 10, topLanguages: { TypeScript: 5 } });
    const ctx = mockCtx({ commandArgs: ["stats"] });
    await cmd.handle(ctx);
    expect(gh.getStats).toHaveBeenCalled();
  });

  it("rejects search without query", async () => {
    const ctx = mockCtx({ commandArgs: ["search"] });
    await cmd.handle(ctx);
    expect(ctx.replyText).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("handles callback for validate", async () => {
    vi.mocked(gh.validate!).mockResolvedValue([{ step: "Token Check", status: "passed", message: "OK" }]);
    const cq = { data: "gh:validate", id: "cq1", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(gh.validate).toHaveBeenCalled();
    expect(ctx.editMessage).toHaveBeenCalledWith(expect.stringContaining("Token Check"), expect.any(Object));
  });

  it("handles callback for back", async () => {
    vi.mocked(gh.getMetadata!).mockResolvedValue({
      username: "testuser", userId: 1, accountType: "User", avatarUrl: "", primaryEmail: null,
      planName: null, organizations: [], publicRepoCount: 5, privateRepoCount: 0,
      detectedCapabilities: ["repositories"], validatedAt: new Date().toISOString(),
    });
    vi.mocked(gh.getHealthRecord!).mockReturnValue({ lastValidated: null, lastConnected: null, failureCount: 0, lastError: null, latency: 0 });
    const cq = { data: "gh:back", id: "cq2", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(gh.getMetadata).toHaveBeenCalled();
  });

  it("handles unknown callback", async () => {
    const cq = { data: "gh:unknown", id: "cq3", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(ctx.answerCallback).toHaveBeenCalledWith("Unknown action", true);
  });
});
