export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessageEntity {
  type: "mention" | "hashtag" | "cashtag" | "bot_command" | "url" | "email" | "phone" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "code" | "pre" | "text_link" | "text_mention";
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
  caption?: string;
  reply_to_message?: TelegramMessage;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  reply_markup?: InlineKeyboardMarkup;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export type ParseMode = "HTML" | "MarkdownV2";

export type ChatAction = "typing" | "upload_photo" | "record_video" | "upload_video" | "record_voice" | "upload_voice" | "upload_document" | "find_location" | "record_video_note" | "upload_video_note";

export interface SendMessagePayload {
  chat_id: number;
  text: string;
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface EditMessageTextPayload {
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
  text: string;
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
  reply_markup?: InlineKeyboardMarkup;
}

export interface EditMessageReplyMarkupPayload {
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface DeleteMessagePayload {
  chat_id: number;
  message_id: number;
}

export interface AnswerCallbackQueryPayload {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

export interface SendChatActionPayload {
  chat_id: number;
  action: ChatAction;
}

export interface SendPhotoPayload {
  chat_id: number;
  photo: string;
  caption?: string;
  parse_mode?: ParseMode;
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface SendDocumentPayload {
  chat_id: number;
  document: string;
  caption?: string;
  parse_mode?: ParseMode;
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
  login_url?: { url: string; forward_text?: string; bot_username?: string; request_write_access?: boolean };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface ReplyKeyboardRemove {
  remove_keyboard: boolean;
  selective?: boolean;
}

export interface ForceReply {
  force_reply: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface TelegramCommandMeta {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
}

export interface TelegramCommand {
  meta: TelegramCommandMeta;
  permissions?: string[];
  handle(ctx: TelegramContext): Promise<void>;
}

export interface TelegramContext {
  update: TelegramUpdate;
  user: TelegramUser | undefined;
  chat: TelegramChat | undefined;
  message: TelegramMessage | undefined;
  callbackQuery: TelegramCallbackQuery | undefined;
  commandArgs: string[];
  botToken: string;
  replyText(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text">): Promise<void>;
  replyMarkdown(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void>;
  replyHTML(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void>;
  replyPhoto(photo: string, caption?: string, options?: Omit<SendPhotoPayload, "chat_id" | "photo">): Promise<void>;
  replyDocument(document: string, caption?: string, options?: Omit<SendDocumentPayload, "chat_id" | "document">): Promise<void>;
  replyKeyboard(text: string, keyboard: ReplyKeyboardMarkup, options?: Omit<SendMessagePayload, "chat_id" | "text" | "reply_markup">): Promise<void>;
  editMessage(text: string, options?: Omit<EditMessageTextPayload, "text">): Promise<void>;
  deleteMessage(): Promise<void>;
  answerCallback(text?: string, showAlert?: boolean): Promise<void>;
  sendTyping(): Promise<void>;
}

export interface TelegramApiError {
  ok: boolean;
  error_code: number;
  description: string;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}
