import type { TelegramUpdate } from "@/types";

export function isTelegramUpdate(body: unknown): body is TelegramUpdate {
  if (typeof body !== "object" || body === null) return false;
  const maybe = body as Record<string, unknown>;
  return typeof maybe.update_id === "number";
}

export function extractCommand(text: string): { command: string; args: string[] } | null {
  const match = text.trim().match(/^\/(\w+)(@\w+)?(?:\s+(.*))?$/s);
  if (!match) return null;
  const body = match[3]?.trim() ?? "";
  const args = body.length > 0 ? body.split(/\s+/) : [];
  return { command: match[1]!, args };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function partition<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
