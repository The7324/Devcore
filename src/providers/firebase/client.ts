import type {
  FirebaseServiceAccount,
  GoogleTokenResponse,
  FirebaseProjectResponse,
  GoogleProjectResponse,
  GoogleServiceResponse,
  FirebaseCapability,
} from "@/providers/firebase/types";
import { FIREBASE_SERVICE_CAPABILITY_MAP } from "@/providers/firebase/types";
import { Logger } from "@/core/logger/logger";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIREBASE_API = "https://firebase.googleapis.com/v1beta1";
const CLOUD_RESOURCE_MANAGER = "https://cloudresourcemanager.googleapis.com/v1";
const SERVICE_USAGE = "https://serviceusage.googleapis.com/v1";

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN[\s\S]*?-----/, "")
    .replace(/-----END[\s\S]*?-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class FirebaseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "FirebaseApiError";
  }
}

export class FirebaseAuthError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "FirebaseAuthError";
  }
}

export class FirebaseClient {
  private cachedToken: { token: string; expiresAt: number } | null = null;
  private readonly sa: FirebaseServiceAccount;

  constructor(
    serviceAccount: FirebaseServiceAccount,
    private readonly logger?: Logger,
  ) {
    this.sa = serviceAccount;
  }

  // ── JWT Assertion & Token Exchange ──

  private async signJwt(
    payload: Record<string, number | string>,
  ): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const enc = new TextEncoder();
    const b64Header = base64UrlEncode(enc.encode(JSON.stringify(header)));
    const b64Payload = base64UrlEncode(enc.encode(JSON.stringify(payload)));
    const toSign = `${b64Header}.${b64Payload}`;

    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        "pkcs8",
        pemToBinary(this.sa.private_key),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
      );
    } catch (e) {
      throw new FirebaseAuthError("Failed to import private key for JWT signing", e);
    }

    let signature: ArrayBuffer;
    try {
      signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        key,
        enc.encode(toSign),
      );
    } catch (e) {
      throw new FirebaseAuthError("Failed to sign JWT assertion", e);
    }

    const b64Signature = base64UrlEncode(signature);
    return `${toSign}.${b64Signature}`;
  }

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    const now = Math.floor(Date.now() / 1000);
    const jwt = await this.signJwt({
      iss: this.sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    });

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });
    } catch (e) {
      throw new FirebaseAuthError("Network error requesting access token", e);
    }

    const latency = Date.now() - start;
    this.logger?.debug("Firebase token exchange", { latency });

    if (!response.ok) {
      const body = await response.text().catch(() => "unknown");
      throw new FirebaseAuthError(
        `Token exchange failed (HTTP ${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const data: GoogleTokenResponse = await response.json();
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  clearTokenCache(): void {
    this.cachedToken = null;
  }

  // ── Authenticated API Calls ──

  private async request<T>(
    url: string,
    method: string = "GET",
    body?: unknown,
  ): Promise<{ data: T; latency: number }> {
    const token = await this.getAccessToken();
    const start = Date.now();
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (e) {
      throw new FirebaseApiError(
        `Network error: ${e instanceof Error ? e.message : "unknown"}`,
        0,
      );
    }

    const latency = Date.now() - start;
    const bodyText = await response.text();

    if (!response.ok) {
      let errBody: { error?: { message?: string; code?: number } } | undefined;
      try { errBody = JSON.parse(bodyText); } catch { /* ignore */ }
      const msg = errBody?.error?.message ?? bodyText.slice(0, 200) ?? `HTTP ${response.status}`;
      throw new FirebaseApiError(msg, response.status, errBody?.error?.code);
    }

    const data: T = JSON.parse(bodyText);
    return { data, latency };
  }

  async getProjectInfo(projectId: string): Promise<FirebaseProjectResponse> {
    const { data } = await this.request<FirebaseProjectResponse>(
      `${FIREBASE_API}/projects/${projectId}`,
    );
    return data;
  }

  async getGoogleProject(projectId: string): Promise<GoogleProjectResponse> {
    const { data } = await this.request<GoogleProjectResponse>(
      `${CLOUD_RESOURCE_MANAGER}/projects/${projectId}`,
    );
    return data;
  }

  async getEnabledServices(projectNumber: string): Promise<FirebaseCapability[]> {
    const capabilities = new Set<FirebaseCapability>();
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ filter: "state:ENABLED", pageSize: "200" });
      if (pageToken) params.set("pageToken", pageToken);

      const { data } = await this.request<GoogleServiceResponse>(
        `${SERVICE_USAGE}/projects/${projectNumber}/services?${params}`,
      );
      for (const svc of data.services ?? []) {
        const svcName = svc.config?.name;
        if (svcName && FIREBASE_SERVICE_CAPABILITY_MAP[svcName]) {
          capabilities.add(FIREBASE_SERVICE_CAPABILITY_MAP[svcName]);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return [...capabilities].sort();
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.getAccessToken();
      const latency = Date.now() - start;
      return { healthy: latency < 5000, latency };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}
