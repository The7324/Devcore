import { Logger } from "@/core/logger/logger";
import { TELEGRAM_API_BASE } from "@/constants";
import { TelegramApiCallError } from "@/telegram/errors";
import type {
  TelegramApiResponse,
  TelegramMessage,
  SendMessagePayload,
  EditMessageTextPayload,
  EditMessageReplyMarkupPayload,
  DeleteMessagePayload,
  AnswerCallbackQueryPayload,
  SendChatActionPayload,
  SendPhotoPayload,
  SendDocumentPayload,
} from "@/telegram/types";

export class TelegramSender {
  private readonly apiBase: string;

  constructor(
    botToken: string,
    private readonly logger: Logger,
  ) {
    this.apiBase = `${TELEGRAM_API_BASE}${botToken}`;
  }

  async sendMessage(payload: SendMessagePayload): Promise<void> {
    await this.call<TelegramMessage>("sendMessage", payload as unknown as Record<string, unknown>);
  }

  async editMessageText(payload: EditMessageTextPayload): Promise<void> {
    await this.call<TelegramMessage>("editMessageText", payload as unknown as Record<string, unknown>);
  }

  async editMessageReplyMarkup(payload: EditMessageReplyMarkupPayload): Promise<void> {
    await this.call<boolean>("editMessageReplyMarkup", payload as unknown as Record<string, unknown>);
  }

  async deleteMessage(payload: DeleteMessagePayload): Promise<void> {
    await this.call<boolean>("deleteMessage", payload as unknown as Record<string, unknown>);
  }

  async answerCallbackQuery(payload: AnswerCallbackQueryPayload): Promise<void> {
    await this.call<boolean>("answerCallbackQuery", payload as unknown as Record<string, unknown>);
  }

  async sendChatAction(payload: SendChatActionPayload): Promise<void> {
    await this.call<boolean>("sendChatAction", payload as unknown as Record<string, unknown>);
  }

  async sendPhoto(payload: SendPhotoPayload): Promise<void> {
    await this.call<TelegramMessage>("sendPhoto", payload as unknown as Record<string, unknown>);
  }

  async sendDocument(payload: SendDocumentPayload): Promise<void> {
    await this.call<TelegramMessage>("sendDocument", payload as unknown as Record<string, unknown>);
  }

  private async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const url = `${this.apiBase}/${method}`;
    const start = Date.now();

    this.logger.debug(`Telegram API call: ${method}`, { payload });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - start;
    const result = await response.json() as TelegramApiResponse<T>;

    if (!result.ok) {
      const errorMsg = result.description ?? "Unknown API error";
      this.logger.error(`Telegram API error: ${method}`, undefined, {
        errorCode: result.error_code,
        description: errorMsg,
        elapsed,
      });
      throw new TelegramApiCallError(errorMsg, method, result.error_code);
    }

    this.logger.debug(`Telegram API success: ${method}`, { elapsed });

    return result.result as T;
  }
}
