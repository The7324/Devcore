import { inlineKeyboard, dataButton } from "@/telegram/buttons";
import type { InlineKeyboardMarkup } from "@/telegram/types";
import type {
  D1Database, D1TableSchema, D1ColumnInfo, D1TableBrowseResult,
  D1Stats, D1HistoryEntry,
} from "@/providers/cloudflare/d1/types";

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10) + " " + iso.slice(11, 19);
}

export function databaseListMarkdown(dbs: D1Database[], activeId?: string): string {
  const lines = ["*D1 Databases*", ""];
  for (const db of dbs) {
    const mark = db.uuid === activeId ? "🟢 " : "";
    lines.push(`${mark}• \`${db.name}\` — ${fmtBytes(db.file_size)}, ${db.num_tables} tables`);
  }
  lines.push("", `Total: ${dbs.length} database${dbs.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function databaseSelectorKeyboard(dbs: D1Database[], prefix: string): InlineKeyboardMarkup {
  const rows = dbs.map((db) => [
    dataButton(`${db.name} (${db.num_tables} tables)`, `${prefix}:select:${db.uuid}`),
  ]);
  rows.push([dataButton("📊 Stats", `${prefix}:stats`)]);
  return inlineKeyboard(rows);
}

export function tableListMarkdown(tables: D1TableSchema[]): string {
  if (!tables.length) return "*Tables*\n\n(none)";
  const lines = ["*Tables*", ""];
  for (const t of tables) {
    lines.push(`• \`${t.name}\``);
  }
  lines.push("", `${tables.length} table${tables.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function tableSelectorKeyboard(tables: D1TableSchema[], prefix: string): InlineKeyboardMarkup {
  const rows = tables.map((t) => [dataButton(`📋 ${t.name}`, `${prefix}:browse:${t.name}`)]);
  rows.push([dataButton("🔙 Back", `${prefix}:back`)]);
  return inlineKeyboard(rows);
}

export function schemaViewMarkdown(columns: D1ColumnInfo[], table: string): string {
  const lines = [`*Schema: ${table}*`, ""];
  for (const c of columns) {
    const pk = c.pk > 0 ? " 🔑" : "";
    const nullable = c.notnull ? "" : " NULL";
    const def = c.dflt_value ? ` = ${c.dflt_value}` : "";
    lines.push(`• \`${c.name}\` — ${c.type}${nullable}${def}${pk}`);
  }
  lines.push("", `${columns.length} column${columns.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function schemaActionKeyboard(table: string, prefix: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [
      dataButton("📋 Columns", `${prefix}:columns:${table}`),
      dataButton("🔗 Foreign Keys", `${prefix}:fks:${table}`),
    ],
    [
      dataButton("📊 Indexes", `${prefix}:indexes:${table}`),
      dataButton("📄 DDL", `${prefix}:ddl:${table}`),
    ],
    [
      dataButton("🔍 Browse", `${prefix}:browse:${table}`),
      dataButton("📥 Export", `${prefix}:export:${table}`),
    ],
    [dataButton("🔙 Back", `${prefix}:back`)],
  ]);
}

export function browseTableMarkdown(result: D1TableBrowseResult, table: string): string {
  const lines = [`*Table: ${table}*`, `Rows: ${result.total} | Page ${result.page + 1} of ${Math.ceil(result.total / result.pageSize) || 1}`, ""];

  if (result.rows.length === 0) {
    lines.push("_(empty)_");
    return lines.join("\n");
  }

  for (const row of result.rows.slice(0, 15)) {
    const vals = result.columns.slice(0, 4).map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      const s = String(v);
      return s.length > 30 ? s.slice(0, 27) + "..." : s;
    }).join(" | ");
    lines.push(`• \`${vals}\``);
  }

  if (result.rows.length > 15) lines.push(`\n… and ${result.rows.length - 15} more`);
  return lines.join("\n");
}

export function browseTableKeyboard(table: string, prefix: string, page: number, totalPages: number): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "⬅️", callback_data: `${prefix}:browse:${table}:${page - 1}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: `${prefix}:browse:${table}:${page}` });
  if (page < totalPages - 1) nav.push({ text: "➡️", callback_data: `${prefix}:browse:${table}:${page + 1}` });
  rows.push(nav);

  rows.push([
    { text: "🔍 Filter", callback_data: `${prefix}:filter:${table}` },
    { text: "📊 Schema", callback_data: `${prefix}:schema:${table}` },
  ]);
  rows.push([{ text: "🔙 Back", callback_data: `${prefix}:back` }]);

  return inlineKeyboard(rows);
}

export function queryResultMarkdown(result: { success: boolean; results?: Record<string, unknown>[]; meta?: { duration?: number; changes?: number; last_row_id?: number }; error?: string }, sql: string): string {
  if (!result.success) return `❌ *Query Failed*\n\n\`${sql.slice(0, 200)}\`\n\nError: ${result.error ?? "Unknown error"}`;

  const lines = [`✅ *Query OK*`, `\`${sql.slice(0, 200)}\``, ""];

  if (result.meta) {
    const parts: string[] = [];
    if (result.meta.duration !== undefined) parts.push(`⏱ ${fmtDuration(result.meta.duration)}`);
    if (result.meta.changes !== undefined) parts.push(`📝 ${result.meta.changes} rows`);
    if (result.meta.last_row_id !== undefined) parts.push(`🆔 last_row_id: ${result.meta.last_row_id}`);
    lines.push(parts.join(" | "), "");
  }

  if (result.results && result.results.length > 0) {
    const cols = Object.keys(result.results[0] ?? {});
    lines.push(`Results: ${result.results.length} row${result.results.length !== 1 ? "s" : ""}`, "");
    for (const row of result.results.slice(0, 20)) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        const s = String(v);
        return s.length > 25 ? s.slice(0, 22) + "..." : s;
      }).join(" | ");
      lines.push(`• \`${vals}\``);
    }
    if (result.results.length > 20) lines.push(`\n… and ${result.results.length - 20} more`);
  }

  return lines.join("\n");
}

export function statsMarkdown(stats: D1Stats): string {
  const largest = stats.largestTable ? `\`${stats.largestTable.name}\` (${stats.largestTable.rows} rows)` : "—";
  const topTables = Object.entries(stats.rowCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => `• \`${name}\`: ${count} rows`).join("\n");

  return [
    `*D1 Database Stats: ${stats.databaseName}*`,
    `━━━━━━━━━━━━━━━━`,
    `Size: ${fmtBytes(stats.fileSize)}`,
    `Version: \`${stats.version}\``,
    `Created: ${fmtDate(stats.created_at)}`,
    "",
    `Tables: ${stats.tableCount}`,
    `Views: ${stats.viewCount}`,
    `Indexes: ${stats.indexCount}`,
    `Triggers: ${stats.triggerCount}`,
    `Total Rows: ${stats.totalRows.toLocaleString()}`,
    `Largest: ${largest}`,
    "",
    `Queries: ${stats.queryCount}`,
    `Avg Query: ${fmtDuration(stats.avgQueryTime)}`,
    "",
    "*Table Row Counts*",
    topTables || "_(none)_",
  ].join("\n");
}

export function historyMarkdown(entries: D1HistoryEntry[], title = "Query History"): string {
  if (!entries.length) return `*${title}*\n\n_(empty)_`;
  const lines = [`*${title}*`, ""];
  for (const e of entries.slice(0, 15)) {
    const icon = e.status === "success" ? "✅" : "❌";
    const fav = e.isFavorite ? "⭐" : "";
    const pin = e.isPinned ? "📌" : "";
    lines.push(`${icon}${fav}${pin} \`${e.sql.slice(0, 60)}\``);
    lines.push(`   ⏱ ${fmtDuration(e.executionTime)} | ${e.timestamp.slice(0, 10)}`);
  }
  if (entries.length > 15) lines.push(`\n… and ${entries.length - 15} more`);
  return lines.join("\n");
}

export function historyKeyboard(prefix: string, page: number, totalPages: number): InlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "⬅️", callback_data: `${prefix}:h_page:${page - 1}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: `${prefix}:h_page:${page}` });
  if (page < totalPages - 1) nav.push({ text: "➡️", callback_data: `${prefix}:h_page:${page + 1}` });
  rows.push(nav);
  rows.push([{ text: "⭐ Favorites", callback_data: `${prefix}:h_favs` }, { text: "🔍 Search", callback_data: `${prefix}:h_search` }]);
  rows.push([{ text: "🔙 Back", callback_data: `${prefix}:back` }]);
  return inlineKeyboard(rows);
}

export function exportFormatKeyboard(prefix: string, target: string): InlineKeyboardMarkup {
  return inlineKeyboard([
    [dataButton("📄 JSON", `${prefix}:export_do:${target}:json`)],
    [dataButton("📊 CSV", `${prefix}:export_do:${target}:csv`)],
    [dataButton("🗄 SQL", `${prefix}:export_do:${target}:sql`)],
    [dataButton("🔙 Back", `${prefix}:back`)],
  ]);
}

export function confirmDestructiveMarkdown(sql: string): string {
  return [
    "⚠️ *Confirm Destructive Operation*",
    "",
    "This query will modify or destroy data:",
    `\`${sql.slice(0, 200)}\``,
    "",
    "Are you sure?",
  ].join("\n");
}
