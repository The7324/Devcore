import type { ProviderMeta } from "@/connections/types";
import type { InlineKeyboardMarkup } from "@/telegram/types";

export function providerSelector(providers: ProviderMeta[], prefix: string): InlineKeyboardMarkup {
  const rows = providers.map((p) => [
    {
      text: `${p.icon} ${p.name}`,
      callback_data: `${prefix}:select:${p.name}`,
    },
  ]);
  return { inline_keyboard: rows };
}

export function environmentSelector(prefix: string): InlineKeyboardMarkup {
  const environments = ["production", "staging", "development", "testing"];
  const rows = environments.map((env) => [
    { text: env, callback_data: `${prefix}:env:${env}` },
  ]);
  return { inline_keyboard: rows };
}
