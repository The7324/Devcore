import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  CollectionInfo,
  BrowseResult,
  FirestoreDocument,
  FirestoreStats,
  FirestoreDatabase,
  FavoriteItem,
  RecentItem,
} from "@/providers/firebase/firestore/types";
import { firestoreFieldsToJson, formatDocumentValue, formatSize, formatTimestamp } from "@/providers/firebase/firestore/format";

function fmtDocId(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1] ?? name;
}

export function databaseListMarkdown(dbs: FirestoreDatabase[], activeId?: string): string {
  const lines = ["*Firestore Databases*", ""];
  for (const db of dbs) {
    const name = db.name.split("/").pop() ?? db.name;
    const mark = name === activeId ? "🟢 " : "";
    lines.push(`${mark}• \`${name}\` — ${db.locationId} — ${db.type.replace("_", " ")}`);
  }
  return lines.join("\n");
}

export function databaseSelectorKeyboard(dbs: FirestoreDatabase[], prefix: string): InlineKeyboardMarkup {
  const rows = dbs.map((db) => {
    const name = db.name.split("/").pop() ?? db.name;
    return [dataButton(`📁 ${name} (${db.locationId})`, `${prefix}:select_db:${name}`)];
  });
  rows.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return inlineKeyboard(rows);
}

export function collectionListMarkdown(collections: CollectionInfo[]): string {
  if (!collections.length) return "*Collections*\n\n_(empty)_";
  const lines = ["*Collections*", ""];
  for (const c of collections) {
    const count = c.documentCount >= 0 ? `${c.documentCount} docs` : "? docs";
    lines.push(`• \`${c.id}\` — ${count}`);
  }
  lines.push("", `${collections.length} collection${collections.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function collectionListKeyboard(collections: CollectionInfo[], prefix: string): InlineKeyboardMarkup {
  const rows = collections.slice(0, 15).map((c) => [
    dataButton(`📋 ${c.id}`, `${prefix}:browse:${c.id}`),
  ]);
  rows.push([
    dataButton("🔍 Search", `${prefix}:search`),
    dataButton("📊 Stats", `${prefix}:stats`),
  ]);
  rows.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return inlineKeyboard(rows);
}

export function documentListMarkdown(result: BrowseResult, collection: string): string {
  const lines = [`*Collection: ${collection}*`, ""];
  if (!result.documents.length) {
    lines.push("_(empty)_");
    return lines.join("\n");
  }
  for (const doc of result.documents.slice(0, 15)) {
    const id = fmtDocId(doc.name);
    const fields = firestoreFieldsToJson(doc.fields);
    const preview = Object.entries(fields).slice(0, 3)
      .map(([k, v]) => `${k}: ${formatDocumentValue(v, 2, 25)}`)
      .join(" | ");
    lines.push(`• \`${id}\``);
    if (preview) lines.push(`  ${preview}`);
  }
  if (result.documents.length > 15) lines.push(`\n… and more`);
  return lines.join("\n");
}

export function documentListKeyboard(
  collection: string,
  prefix: string,
  hasNext: boolean,
  pageToken?: string,
): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const nav: { text: string; callback_data: string }[] = [];
  if (pageToken) nav.push({ text: "⬅️ Prev", callback_data: `${prefix}:prev:${collection}` });
  if (hasNext) nav.push({ text: "➡️ Next", callback_data: `${prefix}:next:${collection}` });
  if (nav.length) rows.push(nav);
  rows.push([
    { text: "➕ New Doc", callback_data: `${prefix}:new:${collection}` },
    { text: "🔍 Query", callback_data: `${prefix}:query:${collection}` },
  ]);
  rows.push([
    { text: "📥 Export", callback_data: `${prefix}:export:${collection}` },
    { text: "📊 Stats", callback_data: `${prefix}:cstats:${collection}` },
  ]);
  rows.push([{ text: "🔙 Back", callback_data: `${prefix}:collections` }]);
  return inlineKeyboard(rows);
}

export function documentViewMarkdown(doc: FirestoreDocument): string {
  const id = fmtDocId(doc.name);
  const fields = firestoreFieldsToJson(doc.fields);
  const fieldLines = Object.entries(fields)
    .map(([k, v]) => `• \`${k}\`: ${formatDocumentValue(v, 4, 40)}`);

  return [
    `*Document: ${id}*`,
    `Created: ${formatTimestamp(doc.createTime)}`,
    `Updated: ${formatTimestamp(doc.updateTime)}`,
    "",
    ...fieldLines,
    "",
    `${fieldLines.length} field${fieldLines.length !== 1 ? "s" : ""}`,
  ].join("\n");
}

export function documentViewKeyboard(
  path: string,
  prefix: string,
): InlineKeyboardMarkup {
  const collection = path.split("/").slice(0, -1).join("/");
  return inlineKeyboard([
    [
      { text: "✏️ Edit", callback_data: `${prefix}:edit:${path}` },
      { text: "📋 Copy", callback_data: `${prefix}:copy:${path}` },
    ],
    [
      { text: "📋 Duplicate", callback_data: `${prefix}:dup:${path}` },
      { text: "🗑 Delete", callback_data: `${prefix}:delete:${path}` },
    ],
    [
      { text: "⭐ Favorite", callback_data: `${prefix}:fav:${path}` },
      { text: "📥 Export", callback_data: `${prefix}:exp_doc:${path}` },
    ],
    [{ text: "🔙 Back to collection", callback_data: `${prefix}:browse:${collection}` }],
  ]);
}

export function queryResultMarkdown(
  documents: FirestoreDocument[],
  sql: string,
  executionTime: number,
): string {
  const lines = [
    `*Query Result*`,
    `\`${sql.slice(0, 200)}\``,
    `⏱ ${executionTime}ms | ${documents.length} doc${documents.length !== 1 ? "s" : ""}`,
    "",
  ];
  if (!documents.length) {
    lines.push("_(no results)_");
    return lines.join("\n");
  }
  for (const doc of documents.slice(0, 10)) {
    const id = fmtDocId(doc.name);
    const fields = firestoreFieldsToJson(doc.fields);
    const preview = Object.entries(fields).slice(0, 3)
      .map(([k, v]) => `${k}: ${formatDocumentValue(v, 2, 20)}`)
      .join(" | ");
    lines.push(`• \`${id}\``);
    if (preview) lines.push(`  ${preview}`);
  }
  if (documents.length > 10) lines.push(`\n… and ${documents.length - 10} more`);
  return lines.join("\n");
}

export function queryResultKeyboard(
  collection: string,
  prefix: string,
): InlineKeyboardMarkup {
  return inlineKeyboard([
    [
      { text: "📥 Export", callback_data: `${prefix}:exp_query:${collection}` },
      { text: "🔍 Refine", callback_data: `${prefix}:query:${collection}` },
    ],
    [{ text: "🔙 Back", callback_data: `${prefix}:browse:${collection}` }],
  ]);
}

export function statsMarkdown(stats: FirestoreStats): string {
  const largest = stats.largestCollections.slice(0, 5)
    .map((c) => `• \`${c.id}\`: ${c.documentCount} docs (${formatSize(c.totalSize)})`)
    .join("\n");

  const recent = stats.recentlyModified.slice(0, 5)
    .map((d) => `• \`${fmtDocId(d.name)}\` — ${formatTimestamp(d.updateTime)}`)
    .join("\n");

  return [
    `*Firestore Stats: ${stats.databaseId}*`,
    `━━━━━━━━━━━━━━━━━━`,
    `Collections: ${stats.collectionCount}`,
    `Documents: ${stats.documentCount.toLocaleString()}`,
    "",
    "*Largest Collections*",
    largest || "_(none)_",
    "",
    "*Recently Modified*",
    recent || "_(none)_",
  ].join("\n");
}

export function confirmDestructiveMarkdown(action: string, target: string): string {
  return [
    "⚠️ *Confirm Destructive Operation*",
    "",
    `Action: \`${action}\``,
    `Target: \`${target}\``,
    "",
    "Are you sure?",
  ].join("\n");
}

export function favoritesMarkdown(items: FavoriteItem[]): string {
  if (!items.length) return "*Favorites*\n\n_(empty)_";
  const lines = ["*Favorites*", ""];
  for (const item of items) {
    const icon = item.type === "collection" ? "📁" : item.type === "document" ? "📄" : "🔍";
    lines.push(`${icon} \`${item.label}\` — ${item.path}`);
  }
  return lines.join("\n");
}

export function recentsMarkdown(items: RecentItem[]): string {
  if (!items.length) return "*Recent*\n\n_(empty)_";
  const lines = ["*Recent*", ""];
  for (const item of items.slice(0, 15)) {
    const icon = item.type === "collection" ? "📁" : item.type === "document" ? "📄" : "🔍";
    lines.push(`${icon} \`${item.label}\` — ${item.path}`);
  }
  return lines.join("\n");
}

export function exportFormatKeyboard(prefix: string, target: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("📄 JSON", `${prefix}:do_export:${target}:json`)],
    [dataButton("📊 CSV", `${prefix}:do_export:${target}:csv`)],
    [dataButton("🔙 Back", `${prefix}:back`)],
  ]);
}

export function favoritesKeyboard(prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("📁 Collections", `${prefix}:fav_collections`)],
    [dataButton("📄 Documents", `${prefix}:fav_documents`)],
    [dataButton("🔙 Back", `${prefix}:collections`)],
  ]);
}

export function recentsKeyboard(prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("📁 Collections", `${prefix}:rec_collections`)],
    [dataButton("📄 Documents", `${prefix}:rec_documents`)],
    [dataButton("🔙 Back", `${prefix}:collections`)],
  ]);
}
