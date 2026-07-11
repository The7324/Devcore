import type {
  QueryAccountsResponse,
  LookupResponse,
  CreateAccountResponse,
  UpdateAccountResponse,
  SendOobCodeResponse,
} from "@/providers/firebase/auth/types";
import { Logger } from "@/core/logger/logger";

const ID_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export class AuthClient {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly projectId: string,
    private readonly logger?: Logger,
  ) {}

  private async request<T>(
    url: string,
    body: unknown,
  ): Promise<T> {
    const token = await this.getToken();
    const start = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - start;
    const bodyText = await response.text();

    if (!response.ok) {
      let errBody: { error?: { message?: string; code?: number } } | undefined;
      try { errBody = JSON.parse(bodyText); } catch { /* ignore */ }
      const msg = errBody?.error?.message ?? bodyText.slice(0, 200);
      this.logger?.error("Auth API error", undefined, { url, status: response.status, msg, latency });
      throw new AuthApiError(msg || `HTTP ${response.status}`, response.status, errBody?.error?.code);
    }

    return JSON.parse(bodyText) as T;
  }

  // ── Query / List Users ──

  async queryAccounts(
    options: {
      maxResults?: number;
      nextPageToken?: string;
      expression?: string;
      returnUserInfo?: boolean;
    } = {},
  ): Promise<QueryAccountsResponse> {
    const url = `${ID_TOOLKIT}/projects/${this.projectId}/accounts:query`;
    return this.request<QueryAccountsResponse>(url, {
      maxResults: options.maxResults ?? 50,
      nextPageToken: options.nextPageToken,
      expression: options.expression,
      returnUserInfo: options.returnUserInfo ?? true,
    });
  }

  // ── Lookup User ──

  async lookupUser(
    localId?: string,
    email?: string,
    phoneNumber?: string,
  ): Promise<LookupResponse> {
    const body: Record<string, string[]> = {};
    if (localId) body.localId = [localId];
    if (email) body.email = [email];
    if (phoneNumber) body.phoneNumber = [phoneNumber];
    return this.request<LookupResponse>(`${ID_TOOLKIT}/accounts:lookup`, body);
  }

  // ── Create User ──

  async createUser(data: {
    email?: string;
    password?: string;
    displayName?: string;
    phoneNumber?: string;
    photoUrl?: string;
    emailVerified?: boolean;
    disabled?: boolean;
    localId?: string;
  }): Promise<CreateAccountResponse> {
    return this.request<CreateAccountResponse>(`${ID_TOOLKIT}/accounts:create`, data);
  }

  // ── Update User ──

  async updateUser(data: {
    localId: string;
    email?: string;
    password?: string;
    displayName?: string;
    phoneNumber?: string;
    photoUrl?: string;
    emailVerified?: boolean;
    disableUser?: boolean;
    customAttributes?: string;
    validSince?: string;
    deleteAttribute?: string[];
    deleteProvider?: string[];
    returnSecureToken?: boolean;
  }): Promise<UpdateAccountResponse> {
    return this.request<UpdateAccountResponse>(`${ID_TOOLKIT}/accounts:update`, data);
  }

  // ── Delete User ──

  async deleteUser(localId: string): Promise<void> {
    await this.request<{}>(`${ID_TOOLKIT}/accounts:delete`, { localId });
  }

  // ── Send OOB Code ──

  async sendOobCode(data: {
    requestType: "PASSWORD_RESET" | "VERIFY_EMAIL" | "EMAIL_SIGNIN";
    email: string;
    returnOobLink?: boolean;
    continueUrl?: string;
    iosApp?: { iosBundleId?: string; iosAppStoreId?: string };
    androidApp?: { androidPackageName?: string; androidMinimumVersion?: string; androidInstallApp?: boolean };
  }): Promise<SendOobCodeResponse> {
    return this.request<SendOobCodeResponse>(`${ID_TOOLKIT}/accounts:sendOobCode`, data);
  }
}
