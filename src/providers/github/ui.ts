import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  GitHubMetadata,
  GitHubCapability,
  GitHubValidationProgress,
  GitHubHealthRecord,
} from "@/providers/github/types";
import { GITHUB_CAPABILITY_LABELS, GITHUB_CAPABILITY_ICONS } from "@/providers/github/types";
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

export function githubCard(name: string, metadata: GitHubMetadata, health: HealthStatus): string {
  const caps = metadata.detectedCapabilities.length > 0
    ? metadata.detectedCapabilities.slice(0, 8).map((c) => {
        const icon = GITHUB_CAPABILITY_ICONS[c] ?? "";
        return `${icon} ${GITHUB_CAPABILITY_LABELS[c] ?? c}`;
      }).join("\n")
    : "None detected";

  const extra = metadata.detectedCapabilities.length > 8
    ? `\n… and ${metadata.detectedCapabilities.length - 8} more`
    : "";

  return [
    `📦 *GitHub: ${name}*`,
    `${healthIcon(health)} Health: \`${health}\``,
    "",
    "*Account*",
    `User: \`@${metadata.username}\``,
    `Type: \`${metadata.accountType}\``,
    `Plan: \`${metadata.planName ?? "—"}\``,
    `Email: \`${metadata.primaryEmail ?? "—"}\``,
    "",
    "*Repositories*",
    `Public: ${metadata.publicRepoCount}`,
    `Private: ${metadata.privateRepoCount ?? "—"}`,
    `Orgs: ${metadata.organizations.length}`,
    "",
    "*Capabilities*",
    caps + extra,
  ].join("\n");
}

export function validationProgressMarkdown(steps: GitHubValidationProgress[], title = "Validation Progress"): string {
  const lines = [`*${title}*`, ""];
  for (const s of steps) {
    const icon = s.status === "passed" ? "✅" : s.status === "failed" ? "❌" : s.status === "running" ? "⏳" : "⬜";
    lines.push(`${icon} **${s.step}** — ${s.message}`);
  }
  return lines.join("\n");
}

export function detectedCapabilitiesMarkdown(capabilities: GitHubCapability[]): string {
  if (capabilities.length === 0) return "_(no capabilities detected)_";
  const lines = ["*Detected GitHub Capabilities*", ""];
  for (const c of capabilities) {
    const icon = GITHUB_CAPABILITY_ICONS[c] ?? "•";
    const label = GITHUB_CAPABILITY_LABELS[c] ?? c;
    lines.push(`${icon} \`${label}\``);
  }
  lines.push("", `${capabilities.length} capabilit${capabilities.length !== 1 ? "ies" : "y"} available`);
  return lines.join("\n");
}

export function healthStatusMarkdown(health: GitHubHealthRecord): string {
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
    [dataButton("📦 Repos", `${prefix}:repos`)],
    [dataButton("🔌 Reconnect", `${prefix}:reconnect`)],
  ]);
}

export function repoStatsMarkdown(stats: {
  totalRepos: number; publicRepos: number; privateRepos: number;
  orgCount: number; stargazers: number; forks: number;
  topLanguages: Record<string, number>;
}): string {
  const langs = Object.entries(stats.topLanguages);
  const langLines = langs.length > 0
    ? langs.map(([lang, count]) => `• \`${lang}\`: ${count} repos`).join("\n")
    : "_(none)_";

  return [
    "*📊 Repository Statistics*",
    `**Total:** ${stats.totalRepos}`,
    `**Public:** ${stats.publicRepos}`,
    `**Private:** ${stats.privateRepos}`,
    `**Organizations:** ${stats.orgCount}`,
    `**Stars:** ${stats.stargazers}`,
    `**Forks:** ${stats.forks}`,
    "",
    "*Top Languages*",
    langLines,
  ].join("\n");
}
