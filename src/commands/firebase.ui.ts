import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  FirebaseMetadata,
  ValidationProgress,
} from "@/providers/firebase/types";
import { FIREBASE_CAPABILITY_LABELS, FIREBASE_CAPABILITY_ICONS } from "@/providers/firebase/types";
import type { HealthStatus, Connection } from "@/connections/types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10) + " " + iso.slice(11, 19);
}

function healthIcon(status: HealthStatus): string {
  switch (status) {
    case "healthy": return "🟢";
    case "warning": return "🟡";
    case "error": return "🔴";
    case "unknown": return "⚪";
  }
}

export function healthDetailMarkdown(
  conn: Connection,
  health: HealthStatus,
): string {
  return [
    `*✅ Firebase Health: ${conn.name}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Status: ${healthIcon(health)} \`${health}\``,
    `Last Validated: ${fmtDate(conn.lastValidatedAt)}`,
    `Last Used: ${fmtDate(conn.lastUsedAt)}`,
    `Environment: \`${conn.environment}\``,
    `Region: \`${conn.region}\``,
  ].join("\n");
}

export function validationStepsMarkdown(
  steps: ValidationProgress[],
  title = "Validation Progress",
): string {
  const lines = [`*${title}*`, ""];
  for (const s of steps) {
    const icon = s.status === "passed" ? "✅" : s.status === "failed" ? "❌" : s.status === "running" ? "⏳" : "⬜";
    lines.push(`${icon} **${s.step}** — ${s.message}`);
  }
  return lines.join("\n");
}

export function projectInfoMarkdown(metadata: FirebaseMetadata): string {
  const caps = metadata.detectedCapabilities.length > 0
    ? metadata.detectedCapabilities.map((c) => {
        const icon = FIREBASE_CAPABILITY_ICONS[c] ?? "";
        return `• ${icon} ${FIREBASE_CAPABILITY_LABELS[c] ?? c}`;
      }).join("\n")
    : "_(none detected)_";

  return [
    `*ℹ️ Firebase Project: ${metadata.projectId}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `**Project ID:** \`${metadata.projectId}\``,
    `**Project Number:** \`${metadata.projectNumber}\``,
    `**Display Name:** ${metadata.displayName}`,
    `**Region:** ${metadata.region ?? "—"}`,
    `**Default Bucket:** ${metadata.defaultBucket ?? "—"}`,
    `**Auth Method:** \`${metadata.authMethod}\``,
    `**SDK Version:** v${metadata.sdkVersion}`,
    `**Validated:** ${fmtDate(metadata.validatedAt)}`,
    "",
    "*Capabilities*",
    caps,
    "",
    `Total: ${metadata.detectedCapabilities.length} service${metadata.detectedCapabilities.length !== 1 ? "s" : ""}`,
  ].join("\n");
}

export function capabilitiesKeyboard(prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("🔄 Validate", `${prefix}:validate`)],
    [dataButton("✅ Health", `${prefix}:health`)],
    [dataButton("ℹ️ Info", `${prefix}:info`)],
    [dataButton("🔌 Reconnect", `${prefix}:reconnect`)],
  ]);
}

export function reconnectConfirmationMarkdown(name: string): string {
  return [
    `*🔌 Reconnect: ${name}*`,
    "",
    "This will refresh the connection and re-validate credentials.",
    "",
    "Proceed?",
  ].join("\n");
}
