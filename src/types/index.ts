import type {
  D1Database as CfD1Database,
} from "@cloudflare/workers-types";

export interface CloudflareBindings {
  DB: CfD1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
  from?: TelegramUser;
  date: number;
}

export interface TelegramChat {
  id: number;
  type: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export type AppEnv = {
  Bindings: CloudflareBindings;
};
