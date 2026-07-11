import type {
  FirestoreDatabase,
  FirestoreDocument,
  ListDocumentsResponse,
  RunQueryRequest,
  RunQueryResponse,
  CommitResponse,
} from "@/providers/firebase/firestore/types";
import { jsonFieldsToFirestore } from "@/providers/firebase/firestore/format";
import { Logger } from "@/core/logger/logger";

const FIRESTORE_API = "https://firestore.googleapis.com/v1";

export class FirestoreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "FirestoreApiError";
  }
}

export class FirestoreClient {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly projectId: string,
    private readonly logger?: Logger,
  ) {}

  private dbPath(databaseId: string): string {
    return `${FIRESTORE_API}/projects/${this.projectId}/databases/${databaseId}`;
  }

  private async request<T>(
    url: string,
    method: string = "GET",
    body?: unknown,
  ): Promise<T> {
    const token = await this.getToken();
    const start = Date.now();
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetch(url, init);
    const latency = Date.now() - start;
    const bodyText = await response.text();

    if (!response.ok) {
      let errBody: { error?: { message?: string; code?: number } } | undefined;
      try { errBody = JSON.parse(bodyText); } catch { /* ignore */ }
      const msg = errBody?.error?.message ?? bodyText.slice(0, 200);
      this.logger?.error("Firestore API error", undefined, { url, status: response.status, msg, latency });
      throw new FirestoreApiError(msg || `HTTP ${response.status}`, response.status, errBody?.error?.code);
    }

    return JSON.parse(bodyText) as T;
  }

  // ── Databases ──

  async listDatabases(): Promise<FirestoreDatabase[]> {
    const url = `${FIRESTORE_API}/projects/${this.projectId}/databases`;
    const { databases } = await this.request<{ databases?: FirestoreDatabase[] }>(url);
    return databases ?? [];
  }

  async getDatabase(databaseId: string): Promise<FirestoreDatabase> {
    return this.request<FirestoreDatabase>(`${this.dbPath(databaseId)}`);
  }

  // ── Documents ──

  async listDocuments(
    databaseId: string,
    collectionId: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      orderBy?: string;
      mask?: string[];
      showMissing?: boolean;
    },
  ): Promise<ListDocumentsResponse> {
    const params = new URLSearchParams();
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));
    if (options?.pageToken) params.set("pageToken", options.pageToken);
    if (options?.orderBy) params.set("orderBy", options.orderBy);
    if (options?.mask?.length) {
      for (const f of options.mask) params.append("mask.fieldPaths", f);
    }
    if (options?.showMissing) params.set("showMissing", "true");
    const qs = params.toString();
    const url = `${this.dbPath(databaseId)}/documents/${collectionId}${qs ? `?${qs}` : ""}`;
    return this.request<ListDocumentsResponse>(url);
  }

  async getDocument(
    databaseId: string,
    path: string,
    mask?: string[],
  ): Promise<FirestoreDocument> {
    const params = mask?.length ? `?${mask.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join("&")}` : "";
    return this.request<FirestoreDocument>(
      `${this.dbPath(databaseId)}/documents/${path}${params}`,
    );
  }

  async createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string | undefined,
    fields: Record<string, unknown>,
  ): Promise<FirestoreDocument> {
    const doc: Record<string, unknown> = { fields: this.toFirestoreFields(fields) };
    let url = `${this.dbPath(databaseId)}/documents/${collectionId}`;
    if (documentId) url += `?documentId=${encodeURIComponent(documentId)}`;
    return this.request<FirestoreDocument>(url, "POST", doc);
  }

  async updateDocument(
    databaseId: string,
    path: string,
    fields: Record<string, unknown>,
    updateMask?: string[],
  ): Promise<FirestoreDocument> {
    const doc: Record<string, unknown> = { fields: this.toFirestoreFields(fields) };
    const params = new URLSearchParams();
    if (updateMask?.length) {
      for (const f of updateMask) params.append("updateMask.fieldPaths", f);
    }
    const qs = params.toString();
    const url = `${this.dbPath(databaseId)}/documents/${path}${qs ? `?${qs}` : ""}`;
    doc["name"] = `projects/${this.projectId}/databases/${databaseId}/documents/${path}`;
    return this.request<FirestoreDocument>(url, "PATCH", doc);
  }

  async deleteDocument(databaseId: string, path: string): Promise<void> {
    await this.request<{}>(`${this.dbPath(databaseId)}/documents/${path}`, "DELETE");
  }

  // ── Queries ──

  async runQuery(
    databaseId: string,
    request: RunQueryRequest,
  ): Promise<RunQueryResponse[]> {
    return this.request<RunQueryResponse[]>(
      `${this.dbPath(databaseId)}/documents:runQuery`,
      "POST",
      request,
    );
  }

  async listCollectionIds(
    databaseId: string,
    pageSize?: number,
    pageToken?: string,
  ): Promise<{ collectionIds: string[]; nextPageToken?: string }> {
    const params = new URLSearchParams();
    if (pageSize) params.set("pageSize", String(pageSize));
    if (pageToken) params.set("pageToken", pageToken);
    const qs = params.toString();
    return this.request<{ collectionIds: string[]; nextPageToken?: string }>(
      `${this.dbPath(databaseId)}/documents:listCollectionIds${qs ? `?${qs}` : ""}`,
      "POST",
      {},
    );
  }

  async beginTransaction(databaseId: string): Promise<{ transaction: string }> {
    return this.request<{ transaction: string }>(
      `${this.dbPath(databaseId)}/documents:beginTransaction`,
      "POST",
      {},
    );
  }

  async commit(
    databaseId: string,
    transaction: string,
    writes: Array<{ update?: FirestoreDocument; delete?: string }>,
  ): Promise<CommitResponse> {
    return this.request<CommitResponse>(
      `${this.dbPath(databaseId)}/documents:commit`,
      "POST",
      { transaction, writes },
    );
  }

  async batchGet(
    databaseId: string,
    documents: string[],
  ): Promise<{
    found?: FirestoreDocument;
    missing?: string;
    readTime: string;
  }[]> {
    return this.request<{
      found?: FirestoreDocument;
      missing?: string;
      readTime: string;
    }[]>(
      `${this.dbPath(databaseId)}/documents:batchGet`,
      "POST",
      { documents: documents.map((d) => `${this.dbPath(databaseId)}/documents/${d}`) },
    );
  }

  // ── Field helpers ──

  private toFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
    return jsonFieldsToFirestore(data);
  }
}
