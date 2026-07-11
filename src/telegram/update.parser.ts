import type { TelegramUpdate } from "@/telegram/types";

export function parseUpdate(body: unknown): TelegramUpdate | null {
  if (typeof body !== "object" || body === null) return null;

  const raw = body as Record<string, unknown>;
  if (typeof raw.update_id !== "number") return null;

  return {
    update_id: raw.update_id,
    ...(raw.message !== undefined && { message: raw.message as TelegramUpdate["message"] }),
    ...(raw.edited_message !== undefined && { edited_message: raw.edited_message as TelegramUpdate["edited_message"] }),
    ...(raw.channel_post !== undefined && { channel_post: raw.channel_post as TelegramUpdate["channel_post"] }),
    ...(raw.callback_query !== undefined && { callback_query: raw.callback_query as TelegramUpdate["callback_query"] }),
  };
}
