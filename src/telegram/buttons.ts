import type { InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton } from "@/telegram/types";

type InlineRow = InlineKeyboardButton[];
type KeyboardRow = KeyboardButton[];

export function inlineKeyboard(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup {
  return { inline_keyboard: rows };
}

export function row(...buttons: InlineKeyboardButton[]): InlineRow {
  return buttons;
}

export function urlButton(text: string, url: string): InlineKeyboardButton {
  return { text, url };
}

export function dataButton(text: string, callbackData: string): InlineKeyboardButton {
  return { text, callback_data: callbackData };
}

export function paginationButtons(
  currentPage: number,
  totalPages: number,
  prefix: string,
): { markup: InlineKeyboardMarkup; pageButtons: InlineRow } {
  const buttons: InlineKeyboardButton[] = [];

  if (currentPage > 0) {
    buttons.push(dataButton("◀️ Previous", `${prefix}:page:${currentPage - 1}`));
  }

  buttons.push(dataButton(`${currentPage + 1}/${totalPages}`, `${prefix}:page:${currentPage}`));

  if (currentPage < totalPages - 1) {
    buttons.push(dataButton("Next ▶️", `${prefix}:page:${currentPage + 1}`));
  }

  return { markup: inlineKeyboard([buttons]), pageButtons: buttons };
}

export function confirmationButtons(prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [
      dataButton("✅ Confirm", `${prefix}:confirm`),
      dataButton("❌ Cancel", `${prefix}:cancel`),
    ],
  ]);
}

export function backButton(callbackData: string): InlineKeyboardMarkup {
  return inlineKeyboard([[dataButton("🔙 Back", callbackData)]]);
}

export function cancelButton(callbackData: string): InlineKeyboardMarkup {
  return inlineKeyboard([[dataButton("❌ Cancel", callbackData)]]);
}

export function replyKeyboard(rows: KeyboardButton[][], options?: { resize?: boolean; oneTime?: boolean; placeholder?: string }): ReplyKeyboardMarkup {
  return {
    keyboard: rows,
    ...(options?.resize && { resize_keyboard: true }),
    ...(options?.oneTime && { one_time_keyboard: true }),
    ...(options?.placeholder && { input_field_placeholder: options.placeholder }),
  };
}

export function keyboardRow(...buttons: KeyboardButton[]): KeyboardRow {
  return buttons;
}

export function textButton(text: string): KeyboardButton {
  return { text };
}

export function contactButton(text: string): KeyboardButton {
  return { text, request_contact: true };
}

export function locationButton(text: string): KeyboardButton {
  return { text, request_location: true };
}
