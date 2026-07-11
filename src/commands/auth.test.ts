import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramContext, TelegramCallbackQuery } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import type { AuthManager } from "@/providers/firebase/auth/manager";
import type { AuthUser } from "@/providers/firebase/auth/types";
import { createAuthCommand } from "@/commands/auth";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";

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

function mockAm(): AuthManager {
  return {
    listUsers: vi.fn(),
    searchUsers: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByPhone: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    enableUser: vi.fn(),
    disableUser: vi.fn(),
    setCustomClaims: vi.fn(),
    getCustomClaims: vi.fn(),
    updateCustomClaims: vi.fn(),
    removeCustomClaims: vi.fn(),
    getStats: vi.fn(),
    getLogs: vi.fn(),
    generatePasswordResetLink: vi.fn(),
    generateEmailVerificationLink: vi.fn(),
    generateSignInLink: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  } as unknown as AuthManager;
}

function mockLayer(am: AuthManager): ConnectionsLayer {
  const conn = { id: "c1", provider: "Firebase", health: "healthy" as const, name: "test", encryptedCredentials: "enc" };
  const fakeProvider = Object.setPrototypeOf(
    { createAuthManager: vi.fn().mockReturnValue(am) },
    FirebaseProviderPlugin.prototype,
  );
  return {
    manager: {
      getActiveConnection: vi.fn().mockReturnValue(conn),
    } as any,
    providerRegistry: {
      get: vi.fn().mockReturnValue(fakeProvider),
    } as any,
    credentialManager: {
      decryptCredentials: vi.fn().mockResolvedValue({ projectId: "p", serviceAccountJson: "{}" }),
    } as any,
  } as unknown as ConnectionsLayer;
}

const sampleUser: AuthUser = {
  localId: "u1",
  email: "a@b.com",
  displayName: "Alice",
  emailVerified: true,
  disabled: false,
  createdAt: "1700000000000",
  lastLoginAt: "1700000001000",
  providerUserInfo: [{ providerId: "password", email: "a@b.com" }],
};

describe("auth command", () => {
  let am: AuthManager;
  let cmd: ReturnType<typeof createAuthCommand>;

  beforeEach(() => {
    am = mockAm();
    cmd = createAuthCommand(mockLayer(am));
  });

  it("status shows stats", async () => {
    vi.mocked(am.getStats!).mockResolvedValue({ totalUsers: 5, verifiedUsers: 3, unverifiedUsers: 1, disabledUsers: 1, providerDistribution: {}, adminEmails: [] });
    const ctx = mockCtx();
    await cmd.handle(ctx);
    expect(ctx.sendTyping).toHaveBeenCalled();
    expect(ctx.replyMarkdown).toHaveBeenCalledWith(expect.stringContaining("5"), expect.any(Object));
  });

  it("list users", async () => {
    vi.mocked(am.listUsers!).mockResolvedValue({ users: [sampleUser], nextPageToken: undefined });
    const ctx = mockCtx({ commandArgs: ["list"] });
    await cmd.handle(ctx);
    expect(am.listUsers).toHaveBeenCalled();
    expect(ctx.replyMarkdown).toHaveBeenCalledWith(expect.stringContaining("u1"), expect.any(Object));
  });

  it("get user by uid", async () => {
    vi.mocked(am.getUser!).mockResolvedValue(sampleUser);
    const ctx = mockCtx({ commandArgs: ["get", "u1"] });
    await cmd.handle(ctx);
    expect(am.getUser).toHaveBeenCalledWith("u1");
  });

  it("get user by email", async () => {
    vi.mocked(am.getUserByEmail!).mockResolvedValue(sampleUser);
    const ctx = mockCtx({ commandArgs: ["email", "a@b.com"] });
    await cmd.handle(ctx);
    expect(am.getUserByEmail).toHaveBeenCalledWith("a@b.com");
  });

  it("search users", async () => {
    vi.mocked(am.searchUsers!).mockResolvedValue({ users: [sampleUser], nextPageToken: undefined });
    const ctx = mockCtx({ commandArgs: ["search", "alice"] });
    await cmd.handle(ctx);
    expect(am.searchUsers).toHaveBeenCalledWith({ query: "alice", maxResults: 50 });
  });

  it("create user", async () => {
    vi.mocked(am.createUser!).mockResolvedValue(sampleUser);
    const ctx = mockCtx({ commandArgs: ["create", "a@b.com", "secret"] });
    await cmd.handle(ctx);
    expect(am.createUser).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" });
  });

  it("disable user", async () => {
    vi.mocked(am.disableUser!).mockResolvedValue({ localId: "u1", disabled: true, emailVerified: true });
    const ctx = mockCtx({ commandArgs: ["disable", "u1"] });
    await cmd.handle(ctx);
    expect(am.disableUser).toHaveBeenCalledWith("u1");
  });

  it("enable user", async () => {
    vi.mocked(am.enableUser!).mockResolvedValue({ localId: "u1", disabled: false, emailVerified: true });
    const ctx = mockCtx({ commandArgs: ["enable", "u1"] });
    await cmd.handle(ctx);
    expect(am.enableUser).toHaveBeenCalledWith("u1");
  });

  it("delete user", async () => {
    vi.mocked(am.deleteUser!).mockResolvedValue(undefined);
    const ctx = mockCtx({ commandArgs: ["delete", "u1"] });
    await cmd.handle(ctx);
    expect(am.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("view claims", async () => {
    vi.mocked(am.getCustomClaims!).mockResolvedValue({ role: "admin" });
    const ctx = mockCtx({ commandArgs: ["claims", "u1"] });
    await cmd.handle(ctx);
    expect(am.getCustomClaims).toHaveBeenCalledWith("u1");
  });

  it("set claim", async () => {
    vi.mocked(am.updateCustomClaims!).mockResolvedValue(undefined);
    vi.mocked(am.getCustomClaims!).mockResolvedValue({ role: "admin" });
    const ctx = mockCtx({ commandArgs: ["set_claim", "u1", "role=admin"] });
    await cmd.handle(ctx);
    expect(am.updateCustomClaims).toHaveBeenCalledWith("u1", { role: "admin" });
  });

  it("remove claim", async () => {
    vi.mocked(am.removeCustomClaims!).mockResolvedValue(undefined);
    vi.mocked(am.getCustomClaims!).mockResolvedValue({});
    const ctx = mockCtx({ commandArgs: ["remove_claim", "u1", "role"] });
    await cmd.handle(ctx);
    expect(am.removeCustomClaims).toHaveBeenCalledWith("u1", ["role"]);
  });

  it("update user field", async () => {
    vi.mocked(am.updateUser!).mockResolvedValue({ localId: "u1", displayName: "Bob", disabled: false, emailVerified: true });
    const ctx = mockCtx({ commandArgs: ["update", "u1", "displayName=Bob"] });
    await cmd.handle(ctx);
    expect(am.updateUser).toHaveBeenCalledWith({ localId: "u1", displayName: "Bob" });
  });

  it("update phone field", async () => {
    vi.mocked(am.updateUser!).mockResolvedValue({ localId: "u1", disabled: false, emailVerified: true });
    const ctx = mockCtx({ commandArgs: ["update", "u1", "phone=+1234567890"] });
    await cmd.handle(ctx);
    expect(am.updateUser).toHaveBeenCalledWith({ localId: "u1", phoneNumber: "+1234567890" });
  });

  it("stats", async () => {
    vi.mocked(am.getStats!).mockResolvedValue({ totalUsers: 10, verifiedUsers: 5, unverifiedUsers: 3, disabledUsers: 2, providerDistribution: { password: 8 }, adminEmails: [] });
    const ctx = mockCtx({ commandArgs: ["stats"] });
    await cmd.handle(ctx);
    expect(am.getStats).toHaveBeenCalled();
  });

  it("rejects missing args for get", async () => {
    const ctx = mockCtx({ commandArgs: ["get"] });
    await cmd.handle(ctx);
    expect(ctx.replyText).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("rejects missing args for create", async () => {
    const ctx = mockCtx({ commandArgs: ["create"] });
    await cmd.handle(ctx);
    expect(ctx.replyText).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("handles callback query for user detail", async () => {
    vi.mocked(am.getUser!).mockResolvedValue(sampleUser);
    const cq = { data: "au:get:u1", id: "cq1", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(am.getUser).toHaveBeenCalledWith("u1");
    expect(ctx.editMessage).toHaveBeenCalledWith(expect.stringContaining("u1"), expect.any(Object));
  });

  it("handles callback query for back", async () => {
    vi.mocked(am.getStats!).mockResolvedValue({ totalUsers: 0, verifiedUsers: 0, unverifiedUsers: 0, disabledUsers: 0, providerDistribution: {}, adminEmails: [] });
    const cq = { data: "au:back", id: "cq2", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(am.getStats).toHaveBeenCalled();
  });

  it("handles unknown callback", async () => {
    const cq = { data: "au:unknown", id: "cq3", from: { id: 1, is_bot: false, first_name: "T" }, chat_instance: "ci" } as TelegramCallbackQuery;
    const ctx = mockCtx({ callbackQuery: cq });
    await cmd.handle(ctx);
    expect(ctx.answerCallback).toHaveBeenCalledWith("Unknown action", true);
  });
});
