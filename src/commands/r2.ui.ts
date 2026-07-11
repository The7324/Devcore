import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type { R2BucketEntry, R2ObjectEntry, R2BucketStats, R2ObjectList } from "@/providers/cloudflare/r2/types";

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10) + " " + iso.slice(11, 19);
}

export function bucketListMarkdown(buckets: R2BucketEntry[], active?: string): string {
  const lines = ["*R2 Buckets*", ""];
  for (const b of buckets) {
    const mark = b.name === active ? "🟢 " : "";
    lines.push(`${mark}• \`${b.name}\` — ${b.location ?? "auto"} (${b.creation_date.slice(0, 10)})`);
  }
  lines.push("", `Total: ${buckets.length} bucket${buckets.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function bucketSelectorKeyboard(buckets: R2BucketEntry[], prefix: string): InlineKeyboardMarkup {
  const btns = buckets.map((b) => [dataButton(b.name, `${prefix}:select:${b.name}`)]);
  btns.push([dataButton("➕ New Bucket", `${prefix}:new`)]);
  return inlineKeyboard(btns);
}

export function objectListMarkdown(list: R2ObjectList, path: string): string {
  const lines: string[] = [];
  if (path) {
    lines.push(`📁 *${path || "/"}*`, "");
  } else {
    lines.push("*R2 Files*", "");
  }

  for (const p of list.prefixes) {
    const name = p.replace(path, "").replace(/\/$/, "");
    lines.push(`📁 ${name}/`);
  }
  for (const o of list.objects) {
    const name = o.key.replace(path, "");
    const icon = iconForExt(o.key);
    lines.push(`${icon} \`${name}\` — ${fmtBytes(o.size)}`);
  }

  if (list.prefixes.length === 0 && list.objects.length === 0) {
    lines.push("_(empty)_");
  }

  lines.push("", `${list.objects.length} file${list.objects.length !== 1 ? "s" : ""}, ${list.prefixes.length} folder${list.prefixes.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function objectBrowserKeyboard(prefix: string, path: string, list: R2ObjectList, _bucket: string): InlineKeyboardMarkup {
  const btns: Array<Array<{ text: string; callback_data: string }>> = [];

  const parentPath = path.replace(/\/$/, "").split("/").slice(0, -1).join("/") || "/";
  if (parentPath !== path && parentPath !== "/") {
    btns.push([{ text: "🔙 ..", callback_data: `${prefix}:cd:${parentPath}` }]);
  } else if (path) {
    btns.push([{ text: "🔙 /", callback_data: `${prefix}:cd:/` }]);
  }

  for (const p of list.prefixes) {
    const name = p.replace(path, "").replace(/\/$/, "");
    btns.push([{ text: `📁 ${name}`, callback_data: `${prefix}:cd:${p}` }]);
  }

  for (const o of list.objects) {
    const name = o.key.replace(path, "");
    const icon = iconForExt(o.key);
    btns.push([{ text: `${icon} ${name}`, callback_data: `${prefix}:info:${o.key}` }]);
  }

  btns.push([
    { text: "⬆️ Upload", callback_data: `${prefix}:upload` },
    { text: "🔍 Search", callback_data: `${prefix}:search` },
  ]);

  if (path) {
    btns.push([{ text: "📊 Stats", callback_data: `${prefix}:stats` }]);
  }

  return inlineKeyboard(btns);
}

export function objectInfoMarkdown(o: R2ObjectEntry, bucket: string): string {
  const icon = iconForExt(o.key);
  return [
    `${icon} *${o.key.split("/").pop() ?? o.key}*`,
    `━━━━━━━━━━━━━━━━`,
    `Path: \`${o.key}\``,
    `Bucket: \`${bucket}\``,
    `Size: ${fmtBytes(o.size)}`,
    `ETag: \`${o.etag.slice(0, 16)}…\``,
    `Modified: ${fmtDate(o.uploaded)}`,
    `Extension: \`${ext(o.key)}\``,
  ].join("\n");
}

export function objectActionKeyboard(prefix: string, key: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [
      { text: "📋 Copy", callback_data: `${prefix}:copy:${key}` },
      { text: "✂️ Move", callback_data: `${prefix}:move:${key}` },
    ],
    [
      { text: "✏️ Rename", callback_data: `${prefix}:rename:${key}` },
      { text: "🔗 Signed URL", callback_data: `${prefix}:sign:${key}` },
    ],
    [
      { text: "⭐ Favorite", callback_data: `${prefix}:fav:${key}` },
      { text: "🗑 Delete", callback_data: `${prefix}:delete:${key}` },
    ],
    [{ text: "🔙 Back", callback_data: `${prefix}:back` }],
  ]);
}

export function statsMarkdown(stats: R2BucketStats): string {
  const top = stats.largestFiles.slice(0, 5).map((o) => `• \`${o.key}\` — ${fmtBytes(o.size)}`).join("\n");
  const recent = stats.newestUploads.slice(0, 5).map((o) => `• \`${o.key}\` — ${fmtDate(o.uploaded)}`).join("\n");
  const types = Object.entries(stats.typeDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([t, c]) => `• \`${t}\`: ${c}`).join("\n");

  return [
    `*R2 Bucket Stats: ${stats.name}*`,
    `━━━━━━━━━━━━━━━━`,
    `Objects: ${stats.objectCount}`,
    `Total Size: ${fmtBytes(stats.totalSize)}`,
    `Created: ${fmtDate(stats.createdDate)}`,
    `Location: ${stats.location ?? "auto"}`,
    "",
    `*Largest Files*`,
    top || "_(none)_",
    "",
    `*Recent Uploads*`,
    recent || "_(none)_",
    "",
    `*File Types*`,
    types || "_(none)_",
  ].join("\n");
}

export function searchResultsMarkdown(results: R2ObjectEntry[], query: string): string {
  if (results.length === 0) return `*Search: "${query}"*\n\nNo results.`;
  const lines = [`*Search: "${query}"*`, "", `Found ${results.length} result${results.length !== 1 ? "s" : ""}`, ""];
  for (const o of results.slice(0, 30)) {
    const icon = iconForExt(o.key);
    lines.push(`${icon} \`${o.key}\` — ${fmtBytes(o.size)}`);
  }
  if (results.length > 30) lines.push(`\n… and ${results.length - 30} more`);
  return lines.join("\n");
}

export function favoritesMarkdown(folders: string[], files: string[]): string {
  const lines = ["*Favorites*", ""];
  if (folders.length) {
    lines.push("*Folders*", ...folders.map((f) => `📁 \`${f}\``), "");
  }
  if (files.length) {
    lines.push("*Files*", ...files.map((f) => `📄 \`${f}\``));
  }
  if (!folders.length && !files.length) lines.push("No favorites yet.");
  return lines.join("\n");
}

export function uploadPromptMarkdown(bucket: string, path: string): string {
  return [
    `*Upload to R2*`,
    `Bucket: \`${bucket}\``,
    `Path: \`${path || "/"}\``,
    "",
    "Send me a file (photo, video, document, audio, or any file).",
    "I will upload it to the current bucket and path.",
    "",
    "Reply with /cancel to abort.",
  ].join("\n");
}

export function uploadProgressMarkdown(fileName: string, size: number, status: string): string {
  return [
    `*Uploading…*`,
    `File: \`${fileName}\``,
    `Size: ${fmtBytes(size)}`,
    `Status: ${status}`,
  ].join("\n");
}

function iconForExt(key: string): string {
  const e = ext(key);
  const img = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"]);
  const video = new Set(["mp4", "webm", "avi", "mov", "mkv", "flv"]);
  const audio = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);
  const doc = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"]);
  const archive = new Set(["zip", "tar", "gz", "bz2", "7z", "rar"]);
  const code = new Set(["js", "ts", "py", "rs", "go", "c", "cpp", "h", "java", "json", "xml", "yaml", "toml", "sh"]);
  if (img.has(e)) return "🖼";
  if (video.has(e)) return "🎬";
  if (audio.has(e)) return "🎵";
  if (doc.has(e)) return "📄";
  if (archive.has(e)) return "📦";
  if (code.has(e)) return "💻";
  return "📎";
}

function ext(key: string): string {
  const i = key.lastIndexOf(".");
  return i >= 0 ? key.slice(i + 1).toLowerCase() : "";
}
