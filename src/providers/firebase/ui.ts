import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  FirebaseMetadata,
  FirebaseCapability,
  ValidationProgress,
  FirebaseHealthRecord,
} from "@/providers/firebase/types";
import { FIREBASE_CAPABILITY_LABELS, FIREBASE_CAPABILITY_ICONS } from "@/providers/firebase/types";
import type { HealthStatus } from "@/connections/types";

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

export function firebaseCard(
  name: string,
  metadata: FirebaseMetadata,
  health: HealthStatus,
): string {
  const caps = metadata.detectedCapabilities.length > 0
    ? metadata.detectedCapabilities.slice(0, 8).map((c) => {
        const icon = FIREBASE_CAPABILITY_ICONS[c] ?? "";
        return `${icon} ${FIREBASE_CAPABILITY_LABELS[c] ?? c}`;
      }).join("\n")
    : "None detected";

  const extra = metadata.detectedCapabilities.length > 8
    ? `\n… and ${metadata.detectedCapabilities.length - 8} more`
    : "";

  return [
    `🔥 *Firebase: ${name}*`,
    `${healthIcon(health)} Health: \`${health}\``,
    "",
    "*Project*",
    `ID: \`${metadata.projectId}\``,
    `Number: \`${metadata.projectNumber}\``,
    `Name: \`${metadata.projectName}\``,
    `Region: \`${metadata.region ?? "—"}\``,
    `Bucket: \`${metadata.defaultBucket ?? "—"}\``,
    "",
    "*Authentication*",
    `Method: \`${metadata.authMethod}\``,
    `SDK: v${metadata.sdkVersion}`,
    `Validated: ${fmtDate(metadata.validatedAt)}`,
    "",
    "*Detected Capabilities*",
    caps + extra,
  ].join("\n");
}

export function projectSummaryMarkdown(metadata: FirebaseMetadata): string {
  const caps = metadata.detectedCapabilities.length > 0
    ? metadata.detectedCapabilities.map((c) => {
        const icon = FIREBASE_CAPABILITY_ICONS[c] ?? "";
        return `• ${icon} ${FIREBASE_CAPABILITY_LABELS[c] ?? c}`;
      }).join("\n")
    : "_(none detected)_";

  return [
    `*🔥 Firebase Project Summary*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `**ID:** \`${metadata.projectId}\``,
    `**Number:** \`${metadata.projectNumber}\``,
    `**Name:** ${metadata.displayName}`,
    `**Region:** ${metadata.region ?? "—"}`,
    `**Bucket:** ${metadata.defaultBucket ?? "—"}`,
    `**Auth:** \`${metadata.authMethod}\``,
    `**Validated:** ${fmtDate(metadata.validatedAt)}`,
    "",
    "*Detected Capabilities*",
    caps,
  ].join("\n");
}

export function validationProgressMarkdown(
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

export function detectedCapabilitiesMarkdown(capabilities: FirebaseCapability[]): string {
  if (capabilities.length === 0) return "_(no capabilities detected)_";
  const lines = ["*Detected Firebase Capabilities*", ""];
  for (const c of capabilities) {
    const icon = FIREBASE_CAPABILITY_ICONS[c] ?? "•";
    const label = FIREBASE_CAPABILITY_LABELS[c] ?? c;
    lines.push(`${icon} \`${label}\``);
  }
  lines.push("", `${capabilities.length} service${capabilities.length !== 1 ? "s" : ""} available`);
  return lines.join("\n");
}

export function healthStatusMarkdown(health: FirebaseHealthRecord): string {
  return [
    "*Health Status*",
    `Last Validated: ${fmtDate(health.lastValidated)}`,
    `Last Connected: ${fmtDate(health.lastConnected)}`,
    `Latency: ${health.latency}ms`,
    `Failures: ${health.failureCount}`,
    health.lastError ? `Last Error: \`${health.lastError}\`` : "",
  ].filter(Boolean).join("\n");
}

export function connectionDetailKeyboard(prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("🔄 Validate", `${prefix}:validate`)],
    [dataButton("✅ Health", `${prefix}:health`)],
    [dataButton("ℹ️ Info", `${prefix}:info`)],
    [dataButton("🔌 Reconnect", `${prefix}:reconnect`)],
  ]);
}
