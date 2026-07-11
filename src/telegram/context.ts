import type { Logger } from "@/core/logger/logger";
import { TelegramSender } from "@/telegram/sender";
import type {
  TelegramUpdate,
  TelegramUser,
  TelegramChat,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramContext as TelegramContextInterface,
  SendMessagePayload,
  SendPhotoPayload,
  SendDocumentPayload,
  ReplyKeyboardMarkup,
  EditMessageTextPayload,
  InlineKeyboardMarkup,
} from "@/telegram/types";

export class TelegramContext implements TelegramContextInterface {
  readonly user: TelegramUser | undefined;
  readonly chat: TelegramChat | undefined;
  readonly message: TelegramMessage | undefined;
  readonly callbackQuery: TelegramCallbackQuery | undefined;
  readonly commandArgs: string[];
  readonly botToken: string;

  private readonly sender: TelegramSender;
  private readonly logger: Logger;

  constructor(
    readonly update: TelegramUpdate,
    botToken: string,
    logger: Logger,
    args?: string[],
    sender?: TelegramSender,
  ) {
    this.botToken = botToken;
    this.sender = sender ?? new TelegramSender(botToken, logger);
    this.logger = logger;
    this.message = update.message ?? update.edited_message;
    this.user = this.message?.from ?? update.callback_query?.from;
    this.chat = this.message?.chat;
    this.callbackQuery = update.callback_query ?? undefined;
    this.commandArgs = args ?? [];
  }

  async replyText(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendMessage({ chat_id: this.chat.id, text, ...options });
    this.logOutgoing("sendMessage", text);
  }

  async replyMarkdown(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendMessage({ chat_id: this.chat.id, text, parse_mode: "Markdown", ...options });
    this.logOutgoing("sendMessage", text);
  }

  async replyHTML(text: string, options?: Omit<SendMessagePayload, "chat_id" | "text" | "parse_mode">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendMessage({ chat_id: this.chat.id, text, parse_mode: "HTML", ...options });
    this.logOutgoing("sendMessage", text);
  }

  async replyPhoto(photo: string, caption?: string, options?: Omit<SendPhotoPayload, "chat_id" | "photo">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendPhoto({ chat_id: this.chat.id, photo, ...(caption && { caption }), ...options });
    this.logOutgoing("sendPhoto", caption ?? photo);
  }

  async replyDocument(document: string, caption?: string, options?: Omit<SendDocumentPayload, "chat_id" | "document">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendDocument({ chat_id: this.chat.id, document, ...(caption && { caption }), ...options });
    this.logOutgoing("sendDocument", caption ?? document);
  }

  async replyKeyboard(text: string, keyboard: ReplyKeyboardMarkup | InlineKeyboardMarkup, options?: Omit<SendMessagePayload, "chat_id" | "text" | "reply_markup">): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendMessage({
      chat_id: this.chat.id,
      text,
      reply_markup: keyboard,
      ...options,
    });
    this.logOutgoing("sendMessage", text);
  }

  async editMessage(text: string, options?: Omit<EditMessageTextPayload, "text">): Promise<void> {
    if (!this.chat) return;
    const messageId = options?.message_id ?? this.message?.message_id;
    if (!messageId) return;
    await this.sender.editMessageText({
      chat_id: this.chat.id,
      message_id: messageId,
      text,
      ...options,
    });
    this.logOutgoing("editMessageText", text);
  }

  async deleteMessage(): Promise<void> {
    if (!this.chat || !this.message) return;
    await this.sender.deleteMessage({
      chat_id: this.chat.id,
      message_id: this.message.message_id,
    });
    this.logOutgoing("deleteMessage");
  }

  async answerCallback(text?: string, showAlert?: boolean): Promise<void> {
    if (!this.callbackQuery) return;
    try {
      await this.sender.answerCallbackQuery({
        callback_query_id: this.callbackQuery.id,
        ...(text && { text }),
        ...(showAlert && { show_alert: true }),
      });
    } catch (err) {
      this.logger.warn("answerCallbackQuery failed (non-fatal)", { error: String(err) });
      return;
    }
    this.logOutgoing("answerCallbackQuery");
  }

  async sendTyping(): Promise<void> {
    if (!this.chat) return;
    await this.sender.sendChatAction({
      chat_id: this.chat.id,
      action: "typing",
    });
  }

  private logOutgoing(method: string, content?: string): void {
    this.logger.debug(`Telegram outgoing: ${method}`, {
      chatId: this.chat?.id,
      userId: this.user?.id,
      ...(content && { preview: content.slice(0, 100) }),
    });
  }
}
