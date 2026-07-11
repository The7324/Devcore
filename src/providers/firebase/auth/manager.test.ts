import { describe, it, expect, vi } from "vitest";
import { AuthManager } from "@/providers/firebase/auth/manager";
import { Logger } from "@/core/logger/logger";

function fakeToken() {
  return Promise.resolve("fake-token");
}

function fakeLogger() {
  return new Logger({ logLevel: "silent" } as any);
}

function makeManager(clientStub: Record<string, any>) {
  const manager = new AuthManager(fakeToken, "proj", fakeLogger());
  (manager as any).client = clientStub;
  return manager;
}

const sampleUser = {
  localId: "u1",
  email: "a@b.com",
  displayName: "Alice",
  emailVerified: true,
  disabled: false,
  createdAt: "1700000000000",
  lastLoginAt: "1700000001000",
  providerUserInfo: [{ providerId: "password", email: "a@b.com" }],
};

const sampleUsers = [
  sampleUser,
  { ...sampleUser, localId: "u2", email: "b@c.com", disabled: true, emailVerified: false },
  { ...sampleUser, localId: "u3", email: "c@d.com", phoneNumber: "+1234567890" },
];

describe("AuthManager", () => {
  describe("listUsers", () => {
    it("returns paginated users", async () => {
      const m = makeManager({
        queryAccounts: vi.fn().mockResolvedValue({ userInfo: sampleUsers, nextPageToken: "tok2" }),
      });
      const res = await m.listUsers();
      expect(res.users).toHaveLength(3);
      expect(res.nextPageToken).toBe("tok2");
    });

    it("passes pageToken to client", async () => {
      const qa = vi.fn().mockResolvedValue({ userInfo: [] });
      await makeManager({ queryAccounts: qa }).listUsers("tok1");
      expect(qa).toHaveBeenCalledWith(expect.objectContaining({ nextPageToken: "tok1" }));
    });
  });

  describe("searchUsers", () => {
    it("filters by email substring", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: sampleUsers }) });
      const res = await m.searchUsers({ query: "b@c" });
      expect(res.users).toHaveLength(1);
      expect(res.users[0]!.localId).toBe("u2");
    });

    it("filters by disabled status", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: sampleUsers }) });
      const res = await m.searchUsers({ status: "disabled" });
      expect(res.users).toHaveLength(1);
      expect(res.users[0]!.localId).toBe("u2");
    });

    it("filters by field", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: sampleUsers }) });
      const res = await m.searchUsers({ query: "123", field: "phone" });
      expect(res.users).toHaveLength(1);
    });
  });

  describe("getUser", () => {
    it("returns user by localId", async () => {
      const m = makeManager({ lookupUser: vi.fn().mockResolvedValue({ users: [sampleUser] }) });
      const user = await m.getUser("u1");
      expect(user.localId).toBe("u1");
    });

    it("throws if not found", async () => {
      const m = makeManager({ lookupUser: vi.fn().mockResolvedValue({ users: [] }) });
      await expect(m.getUser("none")).rejects.toThrow("not found");
    });
  });

  describe("getUserByEmail", () => {
    it("returns user", async () => {
      const m = makeManager({ lookupUser: vi.fn().mockResolvedValue({ users: [sampleUser] }) });
      const user = await m.getUserByEmail("a@b.com");
      expect(user.email).toBe("a@b.com");
    });
  });

  describe("getUserByPhone", () => {
    it("returns user", async () => {
      const m = makeManager({ lookupUser: vi.fn().mockResolvedValue({ users: [sampleUser] }) });
      const user = await m.getUserByPhone("+1234567890");
      expect(user.localId).toBe("u1");
    });
  });

  describe("createUser", () => {
    it("creates and fetches the user", async () => {
      const m = makeManager({
        createUser: vi.fn().mockResolvedValue({ localId: "new1" }),
        lookupUser: vi.fn().mockResolvedValue({ users: [sampleUser] }),
      });
      const user = await m.createUser({ email: "a@b.com", password: "secret" });
      expect(user.localId).toBe("u1");
    });
  });

  describe("updateUser", () => {
    it("updates and returns result", async () => {
      const m = makeManager({
        updateUser: vi.fn().mockResolvedValue({ localId: "u1", displayName: "Bob", disabled: false, emailVerified: true }),
      });
      const res = await m.updateUser({ localId: "u1", displayName: "Bob" });
      expect(res.displayName).toBe("Bob");
    });
  });

  describe("enableUser / disableUser", () => {
    it("enables a user", async () => {
      const upd = vi.fn().mockResolvedValue({ localId: "u1", disabled: false, emailVerified: true });
      const m = makeManager({ updateUser: upd });
      await m.enableUser("u1");
      expect(upd).toHaveBeenCalledWith(expect.objectContaining({ localId: "u1", disableUser: false }));
    });

    it("disables a user", async () => {
      const upd = vi.fn().mockResolvedValue({ localId: "u1", disabled: true, emailVerified: true });
      const m = makeManager({ updateUser: upd });
      await m.disableUser("u1");
      expect(upd).toHaveBeenCalledWith(expect.objectContaining({ localId: "u1", disableUser: true }));
    });
  });

  describe("deleteUser", () => {
    it("deletes without error", async () => {
      const del = vi.fn().mockResolvedValue(undefined);
      const m = makeManager({ deleteUser: del });
      await expect(m.deleteUser("u1")).resolves.toBeUndefined();
      expect(del).toHaveBeenCalledWith("u1");
    });
  });

  describe("custom claims", () => {
    it("sets claims", async () => {
      const upd = vi.fn().mockResolvedValue({});
      const m = makeManager({ updateUser: upd, lookupUser: vi.fn() });
      await m.setCustomClaims("u1", { role: "admin" });
      expect(upd).toHaveBeenCalledWith(expect.objectContaining({ localId: "u1", customAttributes: '{"role":"admin"}' }));
    });

    it("gets claims", async () => {
      const m = makeManager({
        lookupUser: vi.fn().mockResolvedValue({ users: [{ ...sampleUser, customAttributes: '{"role":"admin"}' }] }),
      });
      const claims = await m.getCustomClaims("u1");
      expect(claims).toEqual({ role: "admin" });
    });

    it("merges claims on updateCustomClaims", async () => {
      const m = makeManager({
        lookupUser: vi.fn().mockResolvedValue({ users: [{ ...sampleUser, customAttributes: '{"role":"admin"}' }] }),
        updateUser: vi.fn().mockResolvedValue({}),
      });
      await m.updateCustomClaims("u1", { team: "alpha" });
      const updArg = (m["client"] as any).updateUser.mock.calls[0]![0];
      expect(updArg.customAttributes).toContain("admin");
      expect(updArg.customAttributes).toContain("alpha");
    });

    it("removes claims", async () => {
      const m = makeManager({
        lookupUser: vi.fn().mockResolvedValue({ users: [{ ...sampleUser, customAttributes: '{"role":"admin","team":"alpha"}' }] }),
        updateUser: vi.fn().mockResolvedValue({}),
      });
      await m.removeCustomClaims("u1", ["team"]);
      const updArg2 = (m["client"] as any).updateUser.mock.calls[0]![0];
      expect(updArg2.customAttributes).toBe('{"role":"admin"}');
    });
  });

  describe("OOB codes", () => {
    it("generates password reset link", async () => {
      const m = makeManager({
        sendOobCode: vi.fn().mockResolvedValue({ email: "a@b.com", oobLink: "https://reset", oobCode: "code1" }),
      });
      const res = await m.generatePasswordResetLink("a@b.com");
      expect(res.oobLink).toBe("https://reset");
    });

    it("generates email verification link", async () => {
      const m = makeManager({
        sendOobCode: vi.fn().mockResolvedValue({ email: "a@b.com", oobLink: "https://verify", oobCode: "code2" }),
      });
      const res = await m.generateEmailVerificationLink("a@b.com");
      expect(res.oobLink).toBe("https://verify");
    });

    it("generates sign-in link", async () => {
      const send = vi.fn().mockResolvedValue({ email: "a@b.com", oobLink: "https://signin" });
      const m = makeManager({ sendOobCode: send });
      await m.generateSignInLink("a@b.com");
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ requestType: "EMAIL_SIGNIN" }));
    });
  });

  describe("revokeRefreshTokens", () => {
    it("calls updateUser with validSince", async () => {
      const upd = vi.fn().mockResolvedValue({});
      const m = makeManager({ updateUser: upd });
      await m.revokeRefreshTokens("u1");
      expect(upd).toHaveBeenCalledWith(expect.objectContaining({ localId: "u1" }));
      const arg = upd.mock.calls[0]![0] as any;
      expect(arg.validSince).toBeDefined();
      expect(Number(arg.validSince)).toBeGreaterThan(1700000000);
    });
  });

  describe("getStats", () => {
    it("computes stats from users", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: sampleUsers }) });
      const stats = await m.getStats();
      expect(stats.totalUsers).toBe(3);
      expect(stats.verifiedUsers).toBe(2);
      expect(stats.unverifiedUsers).toBe(1);
      expect(stats.disabledUsers).toBe(1);
    });

    it("detects admin claims", async () => {
      const users = [
        { ...sampleUser, customAttributes: '{"role":"admin"}' },
        { ...sampleUser, localId: "u2", email: "b@c.com", customAttributes: '{"admin":true}' },
        { ...sampleUser, localId: "u3", email: "c@d.com" },
      ];
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: users }) });
      const stats = await m.getStats();
      expect(stats.adminEmails).toHaveLength(2);
    });
  });

  describe("getLogs", () => {
    it("returns action logs", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockResolvedValue({ userInfo: [] }) });
      await m.listUsers();
      const logs = m.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.action).toBe("listUsers");
      expect(logs[0]!.success).toBe(true);
    });
  });

  describe("error logging", () => {
    it("logs errors on failure", async () => {
      const m = makeManager({ queryAccounts: vi.fn().mockRejectedValue(new Error("boom")) });
      await expect(m.listUsers()).rejects.toThrow("boom");
      const logs = m.getLogs();
      expect(logs[0]!.success).toBe(false);
      expect(logs[0]!.error).toContain("boom");
    });
  });
});
