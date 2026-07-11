import type { HealthStatus } from "@/connections/types";
import type { CloudflareMetadata, ValidationProgress } from "@/providers/cloudflare/types";
import { inlineKeyboard, row, dataButton } from "@/telegram/buttons";

const HEALTH_ICON: Record<HealthStatus, string> = {
  healthy: "✅",
  warning: "⚠️",
  error: "❌",
  unknown: "❓",
};

const STEP_ICON: Record<string, { done: string; fail: string; pending: string }> = {
  format: { done: "✓", fail: "✗", pending: "○" },
  api: { done: "✓", fail: "✗", pending: "○" },
  account: { done: "✓", fail: "✗", pending: "○" },
  permissions: { done: "✓", fail: "✗", pending: "○" },
  metadata: { done: "✓", fail: "✗", pending: "○" },
};

export function cloudflareCard(
  name: string,
  metadata: CloudflareMetadata,
  health: HealthStatus,
): string {
  const lines = [
    `☁️ *${name}*`,
    `━━━━━━━━━━━━━━━━`,
    `Account: *${metadata.accountName}*`,
    `Account ID: \`${metadata.accountId}\``,
    `Plan: \`${metadata.accountType}\``,
    `Token: \`${metadata.tokenName}\` (${metadata.tokenStatus})`,
    `Email: ${metadata.email ? `\`${metadata.email}\`` : "—"}`,
    `Status: ${HEALTH_ICON[health]} \`${health}\``,
  ];

  if (metadata.permissions.length > 0) {
    lines.push(`Permissions: ${metadata.permissions.map((p) => `\`${p}\``).join(", ")}`);
  }

  return lines.join("\n");
}

export function validationProgressMarkdown(
  steps: ValidationProgress[],
): string {
  const lines = ["*Validation Progress*", ""];
  for (const s of steps) {
    const icons = STEP_ICON[s.step] ?? { done: "✓", fail: "✗", pending: "○" };
    const icon =
      s.status === "passed" ? icons.done :
      s.status === "failed" ? icons.fail : "○";
    lines.push(`${icon} ${s.message}`);
  }
  return lines.join("\n");
}

export function permissionSummary(permissions: string[]): string {
  if (permissions.length === 0) return "No permissions detected";
  const groups = permissions.map((p) => `• \`${p}\``);
  return ["*Detected Permissions*", "", ...groups].join("\n");
}

export function connectionDetailKeyboard(prefix: string) {
  return inlineKeyboard([
    row(
      dataButton("🔄 Validate", `${prefix}:validate`),
      dataButton("✅ Health", `${prefix}:health`),
    ),
    row(
      dataButton("ℹ️ Info", `${prefix}:info`),
      dataButton("🔌 Reconnect", `${prefix}:reconnect`),
    ),
  ]);
}
