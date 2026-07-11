import type { ConnectionSearchResult } from "@/connections/types";
import { healthIcon } from "@/connections/ui/helpers";
import type { InlineKeyboardMarkup } from "@/telegram/types";

export interface ConnectionListOptions {
  title?: string;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  callbackPrefix?: string;
}

export function connectionListMarkdown(
  result: ConnectionSearchResult,
  options?: ConnectionListOptions,
): string {
  if (result.connections.length === 0) {
    return options?.emptyMessage ?? "No connections found.";
  }

  const title = options?.title ?? "Connections";
  const lines: string[] = [`*${title}*`, ""];

  for (const conn of result.connections) {
    const tags = conn.tags.length > 0 ? ` [${conn.tags.join(", ")}]` : "";
    lines.push(
      `${healthIcon(conn.health)} *${conn.name}* — \`${conn.provider}\`${tags}`,
    );
  }

  lines.push(
    "",
    `Page ${result.page} of ${Math.ceil(result.total / result.pageSize)}`,
    `${result.total} total connections`,
  );

  return lines.join("\n");
}

export function connectionListKeyboard(
  result: ConnectionSearchResult,
  callbackPrefix: string,
): InlineKeyboardMarkup {
  const buttons = result.connections.map((conn) => [
    {
      text: `${healthIcon(conn.health)} ${conn.name} (${conn.provider})`,
      callback_data: `${callbackPrefix}:view:${conn.id}`,
    },
  ]);

  const totalPages = Math.ceil(result.total / result.pageSize);
  if (totalPages > 1 && result.page > 0) {
    const prev = {
      text: "◀️ Previous",
      callback_data: `${callbackPrefix}:page:${result.page - 1}`,
    };
    const next = {
      text: "Next ▶️",
      callback_data: `${callbackPrefix}:page:${result.page + 1}`,
    };
    const label = {
      text: `${result.page}/${totalPages}`,
      callback_data: `${callbackPrefix}:page:${result.page}`,
    };
    buttons.push([prev, label, next]);
  }

  return { inline_keyboard: buttons };
}
