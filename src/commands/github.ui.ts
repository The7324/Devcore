import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type { GitHubRepository } from "@/providers/github/types";

export function repoListMarkdown(repos: GitHubRepository[], title = "Repositories"): string {
  if (repos.length === 0) return "_(no repositories found)_";
  const lines = [`*📦 ${title} (${repos.length})*`, ""];
  for (const r of repos) {
    const icon = r.private ? "🔒" : "📂";
    const desc = r.description ? ` — ${r.description.slice(0, 60)}` : "";
    const stars = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : "";
    lines.push(`${icon} \`${r.full_name}\`${stars}${desc}`);
  }
  return lines.join("\n");
}

export function repoDetailMarkdown(repo: GitHubRepository): string {
  const topics = repo.topics.length > 0 ? repo.topics.map((t) => `\`${t}\``).join(" ") : "—";
  return [
    `*📦 ${repo.full_name}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `**Description:** ${repo.description ?? "—"}`,
    `**Visibility:** ${repo.private ? "🔒 Private" : "📂 Public"}`,
    `**Stars:** ⭐ ${repo.stargazers_count}`,
    `**Forks:** 🍴 ${repo.forks_count}`,
    `**Issues:** 🐛 ${repo.open_issues_count}`,
    `**Language:** ${repo.language ?? "—"}`,
    `**License:** ${repo.license?.name ?? "—"}`,
    `**Size:** ${repo.size} KB`,
    `**Default Branch:** \`${repo.default_branch}\``,
    `**Topics:** ${topics}`,
    `**Fork:** ${repo.fork ? "✅" : "❌"}`,
    `**Archived:** ${repo.archived ? "✅" : "❌"}`,
    `**Created:** ${repo.created_at.slice(0, 10)}`,
    `**Updated:** ${repo.updated_at.slice(0, 10)}`,
    `**URL:** ${repo.html_url}`,
    "",
    repo.permissions
      ? [
          "*Your Permissions*",
          `Admin: ${repo.permissions.admin ? "✅" : "❌"}`,
          `Push: ${repo.permissions.push ? "✅" : "❌"}`,
          `Pull: ${repo.permissions.pull ? "✅" : "❌"}`,
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n");
}

export function repoListKeyboard(prefix: string, hasNext?: boolean, nextToken?: string): InlineKeyboardMarkup {
  const btns = inlineKeyboard([]);
  if (hasNext && nextToken) {
    btns.inline_keyboard.push([dataButton("➡️ Next", `${prefix}:next:${nextToken}`)]);
  }
  btns.inline_keyboard.push([dataButton("🔍 Search", `${prefix}:search`)]);
  btns.inline_keyboard.push([dataButton("📊 Stats", `${prefix}:stats`)]);
  btns.inline_keyboard.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return btns;
}

export function repoDetailKeyboard(owner: string, repo: string, prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("⭐ Favorite", `${prefix}:fav:${owner}:${repo}`)],
    [dataButton("🌐 Open", `${prefix}:open:${owner}:${repo}`)],
    [dataButton("🔙 Back", `${prefix}:repos`)],
  ]);
}

export function searchResultsMarkdown(items: GitHubRepository[], query: string, total: number): string {
  if (items.length === 0) return `_(no results for "${query}")_`;
  const lines = [`*🔍 Search: "${query}"*`, `Found ${total} repository${total !== 1 ? "ies" : "y"}`, ""];
  for (const r of items) {
    const icon = r.private ? "🔒" : "📂";
    const stars = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : "";
    const desc = r.description ? ` — ${r.description.slice(0, 80)}` : "";
    lines.push(`${icon} \`${r.full_name}\`${stars}${desc}`);
  }
  return lines.join("\n");
}

export function searchResultsKeyboard(prefix: string, hasNext?: boolean): InlineKeyboardMarkup {
  const btns = inlineKeyboard([]);
  if (hasNext) btns.inline_keyboard.push([dataButton("➡️ Next Page", `${prefix}:search_next`)]);
  btns.inline_keyboard.push([dataButton("🔙 Back", `${prefix}:repos`)]);
  return btns;
}

export function favoritesMarkdown(repos: GitHubRepository[]): string {
  if (repos.length === 0) return "_(no favorites yet)_";
  return repoListMarkdown(repos, "⭐ Favorites");
}

export function recentsMarkdown(repos: GitHubRepository[]): string {
  if (repos.length === 0) return "_(no recent repositories)_";
  return repoListMarkdown(repos, "🕐 Recent");
}
