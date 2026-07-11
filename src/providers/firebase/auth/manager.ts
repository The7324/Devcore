import { Logger } from "@/core/logger/logger";
import { AuthClient } from "@/providers/firebase/auth/client";
import type {
  AuthUser,
  AuthUserQueryResult,
  AuthSearchOptions,
  AuthUpdateRequest,
  AuthCreateRequest,
  AuthStats,
  AuthUserUpdateResult,
  OobCodeResult,
  AuthLogEntry,
} from "@/providers/firebase/auth/types";

export class AuthManager {
  private readonly client: AuthClient;
  private readonly logs: AuthLogEntry[] = [];
  private readonly logLimit = 500;

  constructor(
    getToken: () => Promise<string>,
    projectId: string,
    private readonly logger: Logger,
  ) {
    this.client = new AuthClient(getToken, projectId, logger);
  }

  private async log(action: string, localId?: string, email?: string, error?: string, start?: number): Promise<void> {
    this.logs.push({ action, localId, email, error, timestamp: new Date().toISOString(), duration: start ? Date.now() - start : 0, success: !error });
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
    if (error) this.logger.error(`Auth ${action} failed`, undefined, { localId, email, error: error.slice(0, 100) });
  }

  getLogs() { return [...this.logs]; }

  // ── List / Search ──

  async listUsers(pageToken?: string, maxResults = 50): Promise<AuthUserQueryResult> {
    const start = Date.now();
    try {
      const response = await this.client.queryAccounts({ maxResults, nextPageToken: pageToken });
      await this.log("listUsers", undefined, undefined, undefined, start);
      return { users: response.userInfo ?? [], nextPageToken: response.nextPageToken };
    } catch (e) {
      await this.log("listUsers", undefined, undefined, String(e), start);
      throw e;
    }
  }

  async searchUsers(options: AuthSearchOptions): Promise<AuthUserQueryResult> {
    const start = Date.now();
    const query = options.query?.toLowerCase() ?? "";
    try {
      // Fetch a batch and filter client-side for substring matching
      const response = await this.client.queryAccounts({ maxResults: options.maxResults ?? 100 });

      let users = response.userInfo ?? [];

      if (query) {
        users = users.filter((u) => {
          switch (options.field) {
            case "uid": return u.localId.toLowerCase().includes(query);
            case "email": return (u.email ?? "").toLowerCase().includes(query);
            case "phone": return (u.phoneNumber ?? "").includes(query);
            case "displayName": return (u.displayName ?? "").toLowerCase().includes(query);
            default:
              return u.localId.toLowerCase().includes(query)
                || (u.email ?? "").toLowerCase().includes(query)
                || (u.displayName ?? "").toLowerCase().includes(query)
                || (u.phoneNumber ?? "").includes(query);
          }
        });
      }

      if (options.status === "disabled") users = users.filter((u) => u.disabled);
      else if (options.status === "enabled") users = users.filter((u) => !u.disabled);

      await this.log("searchUsers", undefined, options.query, undefined, start);
      return { users, nextPageToken: response.nextPageToken };
    } catch (e) {
      await this.log("searchUsers", undefined, options.query, String(e), start);
      throw e;
    }
  }

  async getUser(localId: string): Promise<AuthUser> {
    const start = Date.now();
    try {
      const response = await this.client.lookupUser(localId);
      const user = response.users?.[0];
      if (!user) throw new Error(`User ${localId} not found`);
      await this.log("getUser", localId, user.email, undefined, start);
      return user;
    } catch (e) {
      await this.log("getUser", localId, undefined, String(e), start);
      throw e;
    }
  }

  async getUserByEmail(email: string): Promise<AuthUser> {
    const start = Date.now();
    try {
      const response = await this.client.lookupUser(undefined, email);
      const user = response.users?.[0];
      if (!user) throw new Error(`User with email ${email} not found`);
      await this.log("getUser", user.localId, email, undefined, start);
      return user;
    } catch (e) {
      await this.log("getUser", undefined, email, String(e), start);
      throw e;
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<AuthUser> {
    const start = Date.now();
    try {
      const response = await this.client.lookupUser(undefined, undefined, phoneNumber);
      const user = response.users?.[0];
      if (!user) throw new Error(`User with phone ${phoneNumber} not found`);
      await this.log("getUser", user.localId, undefined, undefined, start);
      return user;
    } catch (e) {
      await this.log("getUser", undefined, undefined, String(e), start);
      throw e;
    }
  }

  // ── CRUD ──

  async createUser(data: AuthCreateRequest): Promise<AuthUser> {
    const start = Date.now();
    try {
      const response = await this.client.createUser(data);
      const user = await this.getUser(response.localId);
      await this.log("createUser", response.localId, data.email, undefined, start);
      return user;
    } catch (e) {
      await this.log("createUser", undefined, data.email, String(e), start);
      throw e;
    }
  }

  async updateUser(data: AuthUpdateRequest): Promise<AuthUserUpdateResult> {
    const start = Date.now();
    try {
      const response = await this.client.updateUser({
        localId: data.localId,
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
        photoUrl: data.photoUrl,
        emailVerified: data.emailVerified,
        disableUser: data.disableUser,
        customAttributes: data.customAttributes,
        deleteAttribute: data.deleteAttribute,
        deleteProvider: data.deleteProvider,
      });
      await this.log("updateUser", data.localId, data.email, undefined, start);
      return {
        localId: response.localId,
        email: response.email,
        displayName: response.displayName,
        providerUserInfo: response.providerUserInfo,
        emailVerified: response.emailVerified,
        disabled: response.disabled,
        lastLoginAt: response.lastLoginAt,
        createdAt: response.createdAt,
        customAttributes: response.customAttributes,
      };
    } catch (e) {
      await this.log("updateUser", data.localId, data.email, String(e), start);
      throw e;
    }
  }

  async deleteUser(localId: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.deleteUser(localId);
      await this.log("deleteUser", localId, undefined, undefined, start);
    } catch (e) {
      await this.log("deleteUser", localId, undefined, String(e), start);
      throw e;
    }
  }

  async enableUser(localId: string): Promise<AuthUserUpdateResult> {
    return this.updateUser({ localId, disableUser: false });
  }

  async disableUser(localId: string): Promise<AuthUserUpdateResult> {
    return this.updateUser({ localId, disableUser: true });
  }

  // ── Custom Claims ──

  async setCustomClaims(localId: string, claims: Record<string, unknown>): Promise<void> {
    const start = Date.now();
    try {
      await this.client.updateUser({ localId, customAttributes: JSON.stringify(claims) });
      await this.log("setCustomClaims", localId, undefined, undefined, start);
    } catch (e) {
      await this.log("setCustomClaims", localId, undefined, String(e), start);
      throw e;
    }
  }

  async getCustomClaims(localId: string): Promise<Record<string, unknown>> {
    const user = await this.getUser(localId);
    try {
      return JSON.parse(user.customAttributes ?? "{}");
    } catch {
      return {};
    }
  }

  async updateCustomClaims(localId: string, claims: Record<string, unknown>): Promise<void> {
    const existing = await this.getCustomClaims(localId);
    const merged = { ...existing, ...claims };
    await this.setCustomClaims(localId, merged);
  }

  async removeCustomClaims(localId: string, keys: string[]): Promise<void> {
    const existing = await this.getCustomClaims(localId);
    for (const key of keys) delete existing[key];
    await this.setCustomClaims(localId, existing);
  }

  // ── Email / Password Actions ──

  async generatePasswordResetLink(email: string): Promise<OobCodeResult> {
    const start = Date.now();
    try {
      const response = await this.client.sendOobCode({
        requestType: "PASSWORD_RESET",
        email,
        returnOobLink: true,
      });
      await this.log("passwordReset", undefined, email, undefined, start);
      return { email, oobLink: response.oobLink, oobCode: response.oobCode };
    } catch (e) {
      await this.log("passwordReset", undefined, email, String(e), start);
      throw e;
    }
  }

  async generateEmailVerificationLink(email: string): Promise<OobCodeResult> {
    const start = Date.now();
    try {
      const response = await this.client.sendOobCode({
        requestType: "VERIFY_EMAIL",
        email,
        returnOobLink: true,
      });
      await this.log("emailVerification", undefined, email, undefined, start);
      return { email, oobLink: response.oobLink, oobCode: response.oobCode };
    } catch (e) {
      await this.log("emailVerification", undefined, email, String(e), start);
      throw e;
    }
  }

  async generateSignInLink(email: string): Promise<OobCodeResult> {
    const start = Date.now();
    try {
      const response = await this.client.sendOobCode({
        requestType: "EMAIL_SIGNIN",
        email,
        returnOobLink: true,
      });
      await this.log("signInLink", undefined, email, undefined, start);
      return { email, oobLink: response.oobLink, oobCode: response.oobCode };
    } catch (e) {
      await this.log("signInLink", undefined, email, String(e), start);
      throw e;
    }
  }

  // ── Revoke Refresh Tokens ──

  async revokeRefreshTokens(localId: string): Promise<void> {
    const start = Date.now();
    try {
      // Set validSince to current timestamp to invalidate existing tokens
      const secondsSinceEpoch = Math.floor(Date.now() / 1000);
      await this.client.updateUser({ localId, validSince: String(secondsSinceEpoch) });
      await this.log("revokeTokens", localId, undefined, undefined, start);
    } catch (e) {
      await this.log("revokeTokens", localId, undefined, String(e), start);
      throw e;
    }
  }

  // ── Stats ──

  async getStats(): Promise<AuthStats> {
    const start = Date.now();
    try {
      const response = await this.client.queryAccounts({ maxResults: 1000 });
      const users = response.userInfo ?? [];

      let verified = 0, unverified = 0, disabled = 0;
      const providerDist: Record<string, number> = {};

      for (const u of users) {
        if (u.emailVerified) verified++; else if (u.email) unverified++;
        if (u.disabled) disabled++;
        const providers = u.providerUserInfo ?? [];
        for (const p of providers) {
          providerDist[p.providerId] = (providerDist[p.providerId] ?? 0) + 1;
        }
      }

      const adminEmails = users
        .filter((u) => {
          try {
            const claims = JSON.parse(u.customAttributes ?? "{}");
            return claims.role === "admin" || claims.admin === true;
          } catch { return false; }
        })
        .map((u) => u.email ?? u.localId);

      await this.log("getStats", undefined, undefined, undefined, start);
      return {
        totalUsers: users.length,
        verifiedUsers: verified,
        unverifiedUsers: unverified,
        disabledUsers: disabled,
        providerDistribution: providerDist,
        adminEmails,
      };
    } catch (e) {
      await this.log("getStats", undefined, undefined, String(e), start);
      throw e;
    }
  }
}
