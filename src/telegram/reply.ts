import { TelegramSender } from "@/telegram/sender";
import type {
  SendMessagePayload,
  SendPhotoPayload,
  SendDocumentPayload,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  EditMessageTextPayload,
} from "@/telegram/types";

export interface ReplyContext {
  chatId: number;
  messageId?: number;
  sender: TelegramSender;
}

export async function replyText(ctx: ReplyContext, text: string, options?: Omit<SendMessagePayload, "chat_id" | "text">): Promise<void> {
  await ctx.sender.sendMessage({
    chat_id: ctx.chatId,
    text,
    ...options,
  });
}

export async function replyMarkdown(ctx: ReplyContext, text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void> {
  await ctx.sender.sendMessage({
    chat_id: ctx.chatId,
    text,
    parse_mode: "MarkdownV2",
    ...options,
  });
}

export async function replyHTML(ctx: ReplyContext, text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void> {
  await ctx.sender.sendMessage({
    chat_id: ctx.chatId,
    text,
    parse_mode: "HTML",
    ...options,
  });
}

export async function replyPhoto(ctx: ReplyContext, photo: string, caption?: string, options?: Omit<SendPhotoPayload, "chat_id" | "photo">): Promise<void> {
  await ctx.sender.sendPhoto({
    chat_id: ctx.chatId,
    photo,
    ...(caption && { caption }),
    ...options,
  });
}

export async function replyDocument(ctx: ReplyContext, document: string, caption?: string, options?: Omit<SendDocumentPayload, "chat_id" | "document">): Promise<void> {
  await ctx.sender.sendDocument({
    chat_id: ctx.chatId,
    document,
    ...(caption && { caption }),
    ...options,
  });
}

export async function replyKeyboard(ctx: ReplyContext, text: string, keyboard: ReplyKeyboardMarkup | ReplyKeyboardRemove, options?: Omit<SendMessagePayload, "chat_id" | "text" | "reply_markup">): Promise<void> {
  await ctx.sender.sendMessage({
    chat_id: ctx.chatId,
    text,
    reply_markup: keyboard,
    ...options,
  });
}

export async function editMessage(ctx: ReplyContext, text: string, options?: Omit<EditMessageTextPayload, "text">): Promise<void> {
  if (!ctx.messageId) return;
  await ctx.sender.editMessageText({
    chat_id: ctx.chatId,
    message_id: ctx.messageId,
    text,
    ...options,
  });
}

export async function editMessageMarkup(ctx: ReplyContext, replyMarkup: InlineKeyboardMarkup): Promise<void> {
  if (!ctx.messageId) return;
  await ctx.sender.editMessageReplyMarkup({
    chat_id: ctx.chatId,
    message_id: ctx.messageId,
    reply_markup: replyMarkup,
  });
}

export async function deleteMessage(ctx: ReplyContext): Promise<void> {
  if (!ctx.messageId) return;
  await ctx.sender.deleteMessage({
    chat_id: ctx.chatId,
    message_id: ctx.messageId,
  });
}

export async function answerCallback(ctx: ReplyContext, queryId: string, text?: string, showAlert?: boolean): Promise<void> {
  await ctx.sender.answerCallbackQuery({
    callback_query_id: queryId,
    ...(text && { text }),
    ...(showAlert && { show_alert: true }),
  });
}

export async function sendTyping(ctx: ReplyContext): Promise<void> {
  await ctx.sender.sendChatAction({
    chat_id: ctx.chatId,
    action: "typing",
  });
}
