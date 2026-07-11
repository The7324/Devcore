import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthClient, AuthApiError } from "@/providers/firebase/auth/client";

const TOKEN = "test-token";
const PROJECT = "test-project";

function mockFetch(status: number, body: unknown, ok?: boolean) {
  return vi.fn().mockResolvedValue({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function createClient() {
  return new AuthClient(() => Promise.resolve(TOKEN), PROJECT);
}

describe("AuthClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends bearer token and content-type", async () => {
    const fetch = mockFetch(200, { users: [] });
    vi.stubGlobal("fetch", fetch);
    const client = createClient();
    await client.queryAccounts();
    const opts = fetch.mock.calls[0]![1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("throws AuthApiError on non-ok response", async () => {
    const fetch = mockFetch(403, { error: { message: "permission denied", code: 403 } }, false);
    vi.stubGlobal("fetch", fetch);
    const client = createClient();
    await expect(client.queryAccounts()).rejects.toThrow(AuthApiError);
    await expect(client.queryAccounts()).rejects.toThrow("permission denied");
  });

  describe("queryAccounts", () => {
    it("returns user list", async () => {
      const body = { userInfo: [{ localId: "u1", email: "a@b.com" }], nextPageToken: "tok" };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().queryAccounts({ maxResults: 10 });
      expect(res.userInfo).toHaveLength(1);
      expect(res.nextPageToken).toBe("tok");
    });
  });

  describe("lookupUser", () => {
    it("looks up by localId", async () => {
      const body = { users: [{ localId: "u1", email: "a@b.com" }] };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().lookupUser("u1");
      expect(res.users[0]!.localId).toBe("u1");
    });

    it("looks up by email", async () => {
      const body = { users: [{ localId: "u1", email: "a@b.com" }] };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().lookupUser(undefined, "a@b.com");
      expect(res.users[0]!.email).toBe("a@b.com");
    });
  });

  describe("createUser", () => {
    it("creates a user and returns response", async () => {
      const body = { localId: "new1", email: "new@b.com" };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().createUser({ email: "new@b.com", password: "secret" });
      expect(res.localId).toBe("new1");
    });
  });

  describe("updateUser", () => {
    it("updates user fields", async () => {
      const body = { localId: "u1", displayName: "New Name", emailVerified: true };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().updateUser({ localId: "u1", displayName: "New Name" });
      expect(res.displayName).toBe("New Name");
    });
  });

  describe("deleteUser", () => {
    it("deletes without error", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {}));
      await expect(createClient().deleteUser("u1")).resolves.toBeUndefined();
    });
  });

  describe("sendOobCode", () => {
    it("sends password reset", async () => {
      const body = { email: "a@b.com", oobLink: "https://reset.link" };
      vi.stubGlobal("fetch", mockFetch(200, body));
      const res = await createClient().sendOobCode({ requestType: "PASSWORD_RESET", email: "a@b.com", returnOobLink: true });
      expect(res.oobLink).toBe("https://reset.link");
    });
  });
});
