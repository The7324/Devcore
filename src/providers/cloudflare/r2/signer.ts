import { Logger } from "@/core/logger/logger";

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const alg = { name: "HMAC", hash: "SHA-256" };
  const cryptoKey = await crypto.subtle.importKey("raw", key, alg, false, ["sign"]);
  const sig = await crypto.subtle.sign(alg, cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function hmacHex(key: Uint8Array, message: string): Promise<string> {
  const sig = await hmac(key, message);
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(message: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return new Uint8Array(hash);
}

async function sha256Hex(message: string): Promise<string> {
  const hash = await sha256(message);
  return toHex(hash);
}

async function deriveSigningKey(secretKey: string, date: string, region: string): Promise<Uint8Array> {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + secretKey), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

export async function generatePresignedUrl(
  options: {
    accessKey: string;
    secretKey: string;
    bucket: string;
    key: string;
    endpoint: string;
    region?: string;
    expiresIn?: number;
    method?: string;
  },
  logger?: Logger,
): Promise<string> {
  const region = options.region ?? "auto";
  const expiresIn = options.expiresIn ?? 3600;
  const method = options.method ?? "GET";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, "").slice(0, 17) + "Z";
  const date = amzDate.slice(0, 8);

  const encodedKey = encodeURIComponent(options.key);
  const canonicalUri = `/${options.bucket}/${encodedKey}`;
  const host = new URL(options.endpoint).host;

  const credentialScope = `${date}/${region}/s3/aws4_request`;

  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${options.accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(options.secretKey, date, region);
  const signature = await hmacHex(signingKey, stringToSign);

  const presignedUrl = `${options.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  logger?.debug("Presigned URL generated", {
    bucket: options.bucket,
    key: options.key,
    expiresIn,
    method,
  });

  return presignedUrl;
}
