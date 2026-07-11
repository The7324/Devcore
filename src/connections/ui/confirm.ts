import { confirmationButtons, cancelButton, backButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";

export function deleteConfirmation(connectionName: string, prefix: string): { text: string; keyboard: InlineKeyboardMarkup } {
  return {
    text: `Are you sure you want to delete *"${connectionName}"*?\n\nThis action cannot be undone.`,
    keyboard: confirmationButtons(`${prefix}:delete`),
  };
}

export function switchConfirmation(connectionName: string, prefix: string): { text: string; keyboard: InlineKeyboardMarkup } {
  return {
    text: `Switch active connection to *"${connectionName}"*?`,
    keyboard: confirmationButtons(`${prefix}:switch`),
  };
}

export function backKeyboard(prefix: string): InlineKeyboardMarkup {
  return backButton(`${prefix}:back`);
}

export function cancelKeyboard(prefix: string): InlineKeyboardMarkup {
  return cancelButton(`${prefix}:cancel`);
}
