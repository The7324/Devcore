import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubClient, GitHubApiError } from "@/providers/github/client";

const TOKEN = "ghp_test_token_12345";

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers ?? {})),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function createClient() {
  return new GitHubClient(TOKEN);
}

describe("GitHubClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends bearer token and accept header", async () => {
    const fetch = mockFetch(200, { login: "testuser" });
    vi.stubGlobal("fetch", fetch);
    const client = createClient();
    await client.getAuthenticatedUser();
    const opts = fetch.mock.calls[0]![1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(headers["Accept"]).toContain("github.v3");
  });

  it("throws GitHubApiError on non-ok", async () => {
      const fetch = mockFetch(401, { message: "Bad credentials" });
      vi.stubGlobal("fetch", fetch);
      const client = createClient();
      await expect(client.getAuthenticatedUser()).rejects.toThrow(GitHubApiError);
  });

  describe("getAuthenticatedUser", () => {
    it("returns user", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { login: "testuser", id: 1 }));
      const user = await createClient().getAuthenticatedUser();
      expect(user.login).toBe("testuser");
    });
  });

  describe("getUser", () => {
    it("returns user by username", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { login: "torvalds", id: 2 }));
      const user = await createClient().getUser("torvalds");
      expect(user.login).toBe("torvalds");
    });
  });

  describe("getOrganizations", () => {
    it("returns orgs list", async () => {
      vi.stubGlobal("fetch", mockFetch(200, [{ login: "org1" }, { login: "org2" }]));
      const orgs = await createClient().getOrganizations();
      expect(orgs).toHaveLength(2);
    });
  });

  describe("getRepository", () => {
    it("returns repo details", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { full_name: "owner/repo", stargazers_count: 10 }));
      const repo = await createClient().getRepository("owner", "repo");
      expect(repo.full_name).toBe("owner/repo");
      expect(repo.stargazers_count).toBe(10);
    });
  });

  describe("searchRepositories", () => {
    it("returns search results", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { items: [{ full_name: "a/b" }], total_count: 1, incomplete_results: false }));
      const result = await createClient().searchRepositories("test");
      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  describe("checkToken", () => {
    it("returns user and scopes", async () => {
      const headers = { "X-OAuth-Scopes": "repo, user" };
      const fetch = mockFetch(200, { login: "testuser" }, headers);
      vi.stubGlobal("fetch", fetch);
      const result = await createClient().checkToken();
      expect(result.user.login).toBe("testuser");
      expect(result.scopes).toContain("repo");
    });
  });

  describe("healthCheck", () => {
    it("returns healthy on success", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {}));
      const result = await createClient().healthCheck();
      expect(result.healthy).toBe(true);
    });
  });

  describe("getRateLimit", () => {
    it("returns rate limit info", async () => {
      const body = { resources: { core: { limit: 5000, remaining: 4999, reset: 0, used: 1 }, search: { limit: 30, remaining: 29, reset: 0, used: 1 } }, rate: { limit: 5000, remaining: 4999, reset: 0, used: 1 } };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const rate = await createClient().getRateLimit();
      expect(rate.resources.core.remaining).toBe(4999);
    });
  });
});
