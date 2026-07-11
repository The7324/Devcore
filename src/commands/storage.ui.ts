import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  BrowseResult,
  FileEntry,
  StorageObject,
  StorageStats,
  StorageBucket,
  FavoriteItem,
  RecentItem,
} from "@/providers/firebase/storage/types";
import { classifyContentType, formatBytes } from "@/providers/firebase/storage/manager";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10) + " " + iso.slice(11, 19);
}

function fileIcon(entry: FileEntry): string {
  if (entry.type === "folder") return "📁";
  const type = classifyContentType(entry.contentType ?? "");
  switch (type) {
    case "image": return "🖼";
    case "video": return "🎬";
    case "audio": return "🎵";
    case "document": return "📄";
    case "archive": return "📦";
    default: return "📎";
  }
}

export function bucketListMarkdown(buckets: StorageBucket[], activeId?: string): string {
  const lines = ["*Storage Buckets*", ""];
  for (const b of buckets) {
    const mark = b.name === activeId ? "🟢 " : "";
    lines.push(`${mark}• \`${b.name}\` — ${b.location} — ${b.storageClass}`);
  }
  return lines.join("\n");
}

export function bucketSelectorKeyboard(buckets: StorageBucket[], prefix: string): InlineKeyboardMarkup {
  const rows = buckets.map((b) => [dataButton(`📦 ${b.name}`, `${prefix}:select_bucket:${b.name}`)]);
  rows.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return inlineKeyboard(rows);
}

export function folderBrowserMarkdown(
  result: BrowseResult,
  currentPrefix: string,
): string {
  const lines = [`*Storage Browser*`, `Path: \`/${currentPrefix}\``, ""];
  if (!result.folders.length && !result.files.length) {
    lines.push("_(empty)_");
    return lines.join("\n");
  }
  for (const f of result.folders) {
    lines.push(`📁 \`${f.name}/\``);
  }
  for (const file of result.files.slice(0, 20)) {
    const icon = fileIcon(file);
    const size = file.size !== undefined ? formatBytes(file.size as number) : "?";
    lines.push(`${icon} \`${file.name}\` — ${size}`);
  }
  return lines.join("\n");
}

export function folderBrowserKeyboard(
  prefix: string,
  currentPrefix: string,
  hasNext: boolean,
  pageToken?: string,
): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const nav: { text: string; callback_data: string }[] = [];
  if (currentPrefix) nav.push({ text: "⬆️ Up", callback_data: `${prefix}:up` });
  if (hasNext && pageToken) nav.push({ text: "➡️ Next", callback_data: `${prefix}:next` });
  if (nav.length) rows.push(nav);
  rows.push([
    { text: "📁 New Folder", callback_data: `${prefix}:mkdir` },
    { text: "⬆️ Upload", callback_data: `${prefix}:upload` },
  ]);
  rows.push([
    { text: "🔍 Search", callback_data: `${prefix}:search` },
    { text: "📊 Stats", callback_data: `${prefix}:stats` },
  ]);
  return inlineKeyboard(rows);
}

export function fileDetailMarkdown(file: StorageObject, bucket: string): string {
  const name = file.name.split("/").pop() ?? file.name;
  const type = classifyContentType(file.contentType ?? "");

  const lines = [
    `*File: ${name}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Bucket: \`${bucket}\``,
    `Path: \`${file.name}\``,
    `Size: ${formatBytes(file.size)}`,
    `Type: \`${file.contentType ?? "—"}\``,
    `Category: ${type}`,
    `Created: ${fmtDate(file.timeCreated)}`,
    `Modified: ${fmtDate(file.updated)}`,
    `Storage Class: \`${file.storageClass}\``,
    `Generation: \`${file.generation}\``,
    `MD5: \`${file.md5Hash ?? "—"}\``,
    file.metadata && Object.keys(file.metadata).length > 0
      ? `\nMetadata: ${Object.entries(file.metadata).map(([k, v]) => `${k}=${v}`).join(", ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function fileDetailKeyboard(
  path: string,
  bucket: string,
  prefix: string,
): InlineKeyboardMarkup {
  return inlineKeyboard([
    [
      { text: "🔗 Download URL", callback_data: `${prefix}:url:${path}` },
      { text: "📋 Copy", callback_data: `${prefix}:copy:${path}` },
    ],
    [
      { text: "✏️ Rename", callback_data: `${prefix}:rename:${path}` },
      { text: "📋 Duplicate", callback_data: `${prefix}:dup:${path}` },
    ],
    [
      { text: "🗑 Delete", callback_data: `${prefix}:delete:${path}` },
      { text: "⭐ Fav", callback_data: `${prefix}:fav:${path}` },
    ],
    [{ text: "🔙 Back", callback_data: `${prefix}:browse:${bucket}:${path.split("/").slice(0, -1).join("/")}` }],
  ]);
}

export function statsMarkdown(stats: StorageStats): string {
  const typeDist = Object.entries(stats.typeDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `• ${k}: ${v} file${v !== 1 ? "s" : ""}`).join("\n");

  const largest = stats.largestFiles.slice(0, 5)
    .map((f) => `• \`${f.name}\` — ${f.size ? formatBytes(f.size as number) : "?"}`)
    .join("\n");

  const newest = stats.newestFiles.slice(0, 5)
    .map((f) => `• \`${f.name}\` — ${fmtDate(f.updated)}`)
    .join("\n");

  return [
    `*Storage Stats: ${stats.bucketName}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `Location: ${stats.location}`,
    `Storage Class: ${stats.storageClass}`,
    `Files: ${stats.objectCount.toLocaleString()}`,
    `Total Size: ${formatBytes(stats.totalSize)}`,
    "",
    "*File Type Distribution*",
    typeDist || "_(none)_",
    "",
    "*Largest Files*",
    largest || "_(none)_",
    "",
    "*Newest Files*",
    newest || "_(none)_",
  ].join("\n");
}

export function searchResultsMarkdown(result: { files: FileEntry[]; query: string; executionTime: number }): string {
  if (!result.files.length) return `*Search: "${result.query}"*\n\nNo results.`;
  const lines = [`*Search: "${result.query}"*`, `⏱ ${result.executionTime}ms | ${result.files.length} results`, ""];
  for (const f of result.files.slice(0, 15)) {
    const icon = fileIcon(f);
    lines.push(`${icon} \`${f.name}\` — ${f.size ? formatBytes(f.size as number) : "?"}`);
  }
  if (result.files.length > 15) lines.push(`\n… and ${result.files.length - 15} more`);
  return lines.join("\n");
}

export function searchResultsKeyboard(prefix: string, bucket: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [{ text: "🔙 Back to browser", callback_data: `${prefix}:browse:${bucket}:` }],
  ]);
}

export function favoritesMarkdown(items: FavoriteItem[]): string {
  if (!items.length) return "*Favorites*\n\n_(empty)_";
  const lines = ["*Favorites*", ""];
  for (const item of items) {
    const icon = item.type === "folder" ? "📁" : item.type === "file" ? "📄" : "📦";
    lines.push(`${icon} \`${item.label}\` — ${item.path}`);
  }
  return lines.join("\n");
}

export function recentsMarkdown(items: RecentItem[]): string {
  if (!items.length) return "*Recent*\n\n_(empty)_";
  const lines = ["*Recent*", ""];
  for (const item of items.slice(0, 15)) {
    const icon = item.type === "folder" ? "📁" : item.type === "file" ? "📄" : "📦";
    lines.push(`${icon} \`${item.label}\` — ${item.path}`);
  }
  return lines.join("\n");
}

export function uploadPromptMarkdown(bucket: string, prefix: string): string {
  return [
    "*⬆️ Upload File*",
    `Bucket: \`${bucket}\``,
    `Folder: \`/${prefix}\``,
    "",
    "Send me a file to upload.",
  ].join("\n");
}

export function confirmDeleteMarkdown(path: string): string {
  return [
    "⚠️ *Confirm Delete*",
    "",
    `\`${path}\``,
    "",
    "This action cannot be undone.",
    "Are you sure?",
  ].join("\n");
}

export function urlMarkdown(url: string, bucket: string, path: string): string {
  return [
    `*Download URL*`,
    `File: \`${path}\``,
    `Bucket: \`${bucket}\``,
    "",
    `\`${url}\``,
  ].join("\n");
}
