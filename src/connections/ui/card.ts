import type { Connection } from "@/connections/types";
import { healthIcon, statusLabel } from "@/connections/ui/helpers";

export function connectionCard(conn: Connection): string {
  const lines: string[] = [
    `${conn.icon} *${conn.name}*`,
    `━━━━━━━━━━━━━━━━`,
    `Provider: \`${conn.provider}\``,
    `Status: ${statusLabel(conn.status)} ${healthIcon(conn.health)}`,
    `Environment: \`${conn.environment}\``,
    `Region: \`${conn.region || "—"}\``,
  ];

  if (conn.description) {
    lines.push(`Description: ${conn.description}`);
  }

  if (conn.tags.length > 0) {
    lines.push(`Tags: ${conn.tags.map((t) => `\`${t}\``).join(", ")}`);
  }

  lines.push(
    `Created: \`${new Date(conn.createdAt).toLocaleString()}\``,
    `Updated: \`${new Date(conn.updatedAt).toLocaleString()}\``,
  );

  if (conn.lastUsedAt) {
    lines.push(`Last used: \`${new Date(conn.lastUsedAt).toLocaleString()}\``);
  }

  lines.push(`ID: \`${conn.id}\``);

  return lines.join("\n");
}

export function connectionSummary(conn: Connection): string {
  return `${healthIcon(conn.health)} *${conn.name}* — ${conn.provider} (${conn.environment})`;
}
