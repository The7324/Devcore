import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type { AuthUser, AuthUserQueryResult, AuthStats, AuthUserUpdateResult } from "@/providers/firebase/auth/types";

function fmtDate(ts?: string): string {
  if (!ts || ts === "0") return "—";
  const d = new Date(Number(ts));
  return isNaN(d.getTime()) ? ts.slice(0, 10) : d.toISOString().slice(0, 10) + " " + d.toISOString().slice(11, 19);
}

function statusIcon(user: AuthUser): string {
  if (user.disabled) return "🔴";
  if (user.emailVerified) return "🟢";
  return "🟡";
}

export function userListMarkdown(users: AuthUser[]): string {
  if (users.length === 0) return "_(no users found)_";
  const lines = [`*👥 Users (${users.length})*`, ""];
  for (const u of users) {
    const icon = statusIcon(u);
    const email = u.email ?? "—";
    const name = u.displayName ? ` (${u.displayName})` : "";
    lines.push(`${icon} \`${u.localId.slice(0, 12)}…\` — ${email}${name}`);
  }
  return lines.join("\n");
}

export function userListKeyboard(prefix: string, hasNext?: boolean, nextToken?: string): InlineKeyboardMarkup {
  const buttons = inlineKeyboard([]);
  if (hasNext && nextToken) {
    buttons.inline_keyboard.push([dataButton("➡️ Next", `${prefix}:next:${nextToken}`)]);
  }
  buttons.inline_keyboard.push([dataButton("🔍 Search", `${prefix}:search`)]);
  buttons.inline_keyboard.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return buttons;
}

export function userDetailMarkdown(user: AuthUser): string {
  const icon = statusIcon(user);
  const status = user.disabled ? "Disabled" : user.emailVerified ? "Active & Verified" : "Active (unverified)";
  const provs = (user.providerUserInfo ?? []).map((p) => `• ${p.providerId}${p.email ? ` — ${p.email}` : ""}`).join("\n") || "_(none)_";

  return [
    `${icon} *User: \`${user.localId}\`*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `**Status:** ${status}`,
    `**Email:** ${user.email ?? "—"}`,
    `**Display Name:** ${user.displayName ?? "—"}`,
    `**Phone:** ${user.phoneNumber ?? "—"}`,
    `**Photo:** ${user.photoUrl ? `[link](${user.photoUrl})` : "—"}`,
    `**Created:** ${fmtDate(user.createdAt)}`,
    `**Last Login:** ${fmtDate(user.lastLoginAt)}`,
    `**Email Verified:** ${user.emailVerified ? "✅" : "❌"}`,
    `**Disabled:** ${user.disabled ? "✅" : "❌"}`,
    ``,
    `*Providers*`,
    provs,
  ].join("\n");
}

export function userDetailKeyboard(uid: string, prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("🔓 Enable", `${prefix}:enable:${uid}`), dataButton("🔒 Disable", `${prefix}:disable:${uid}`)],
    [dataButton("🗑 Delete", `${prefix}:delete:${uid}`), dataButton("🔑 Claims", `${prefix}:claims:${uid}`)],
    [dataButton("🔙 Back", `${prefix}:back`)],
  ]);
}

export function statsMarkdown(s: AuthStats): string {
  const provs = Object.entries(s.providerDistribution)
    .map(([k, v]) => `• \`${k}\`: ${v}`)
    .join("\n") || "_(none)_";

  const admins = s.adminEmails.length > 0
    ? s.adminEmails.map((e) => `• \`${e}\``).join("\n")
    : "_(none)_";

  return [
    `*📊 Auth Statistics*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `**Total Users:** ${s.totalUsers}`,
    `**Verified:** ${s.verifiedUsers}`,
    `**Unverified:** ${s.unverifiedUsers}`,
    `**Disabled:** ${s.disabledUsers}`,
    ``,
    `*Provider Distribution*`,
    provs,
    ``,
    `*Admins*`,
    admins,
  ].join("\n");
}

export function confirmMarkdown(action: string, uid: string, email?: string, destructive?: boolean): string {
  const icon = destructive ? "⚠️" : "🔒";
  return [
    `${icon} *${action}*`,
    ``,
    `Are you sure you want to ${action.toLowerCase()}?`,
    `**UID:** \`${uid}\``,
    email ? `**Email:** ${email}` : "",
    ``,
    destructive ? "This action cannot be undone!" : "",
  ].filter(Boolean).join("\n");
}

export function createUserMarkdown(user: AuthUser): string {
  return [
    `✅ *User Created*`,
    `**UID:** \`${user.localId}\``,
    `**Email:** ${user.email ?? "—"}`,
    `**Display Name:** ${user.displayName ?? "—"}`,
  ].join("\n");
}

export function updateUserMarkdown(result: AuthUserUpdateResult, action: string): string {
  return [
    `✅ *${action}*`,
    `**UID:** \`${result.localId}\``,
    `**Email:** ${result.email ?? "—"}`,
    `**Status:** ${result.disabled ? "🔴 Disabled" : "🟢 Enabled"}`,
    `**Verified:** ${result.emailVerified ? "✅" : "❌"}`,
  ].join("\n");
}

export function claimsMarkdown(uid: string, claims: Record<string, unknown>): string {
  const entries = Object.entries(claims);
  const body = entries.length > 0
    ? entries.map(([k, v]) => `• \`${k}\`: \`${JSON.stringify(v)}\``).join("\n")
    : "_(no custom claims)_";
  return [
    `*🔑 Custom Claims: \`${uid}\`*`,
    ``,
    body,
  ].join("\n");
}

export function searchResultsMarkdown(result: AuthUserQueryResult, query: string): string {
  if (result.users.length === 0) return `_(no results for "${query}")_`;
  const lines = [`*🔍 Search: "${query}"*`, `Found ${result.users.length} user${result.users.length !== 1 ? "s" : ""}`, ""];
  for (const u of result.users) {
    const icon = statusIcon(u);
    const email = u.email ?? "—";
    lines.push(`${icon} \`${u.localId.slice(0, 12)}…\` — ${email}`);
  }
  return lines.join("\n");
}
