import { CloudflareClient } from "@/providers/cloudflare/client";
import { detectPermissionScopes } from "@/providers/cloudflare/permissions";
import type { CloudflareMetadata, TokenVerifyResult, AccountResult, UserResult } from "@/providers/cloudflare/types";

export async function collectMetadata(
  client: CloudflareClient,
): Promise<{ metadata: CloudflareMetadata; latency: number }> {
  const [verifyRes, accountRes, userRes] = await Promise.all([
    client.get<TokenVerifyResult>("/user/tokens/verify"),
    client.get<AccountResult[]>("/accounts"),
    client.get<UserResult>("/user").catch(() => null),
  ]);

  const totalLatency = verifyRes.latency + accountRes.latency + (userRes?.latency ?? 0);
  const verify = verifyRes.data.result;
  const account = accountRes.data.result[0];
  const user = userRes?.data?.result;

  const permissions = detectPermissionScopes(verify.permissions);

  const metadata: CloudflareMetadata = {
    accountName: account?.name ?? "Unknown",
    accountId: account?.id ?? "Unknown",
    accountType: account?.type ?? "Unknown",
    accountCreatedOn: account?.created_on ?? "",
    tokenName: verify.name,
    tokenId: verify.id,
    tokenStatus: verify.status,
    permissions,
    email: user?.email ?? null,
  };

  return { metadata, latency: totalLatency };
}
