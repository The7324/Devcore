export class TelegramError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

export class TelegramApiCallError extends TelegramError {
  constructor(
    message: string,
    public readonly method: string,
    code?: number,
  ) {
    super(`Telegram API "${method}" failed: ${message}`, code);
    this.name = "TelegramApiCallError";
  }
}
