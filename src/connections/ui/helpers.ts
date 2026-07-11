import type { HealthStatus, ConnectionStatus } from "@/connections/types";

const HEALTH_ICONS: Record<HealthStatus, string> = {
  healthy: "✅",
  warning: "⚠️",
  error: "❌",
  unknown: "❓",
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  error: "Error",
};

export function healthIcon(status: HealthStatus): string {
  return HEALTH_ICONS[status] ?? "❓";
}

export function statusLabel(status: ConnectionStatus): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

export function formatConnectionsCount(total: number, filtered?: number): string {
  if (filtered !== undefined && filtered !== total) {
    return `${filtered} of ${total} connections`;
  }
  return `${total} connection${total !== 1 ? "s" : ""}`;
}

export function truncate(text: string, max = 50): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}
