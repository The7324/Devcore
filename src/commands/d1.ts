import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { CloudflareProviderPlugin } from "@/providers/cloudflare/plugin";
import type { D1DatabaseManager } from "@/providers/cloudflare/d1";
import {
  databaseListMarkdown, databaseSelectorKeyboard,
  tableListMarkdown, tableSelectorKeyboard,
  schemaViewMarkdown, schemaActionKeyboard,
  browseTableMarkdown, browseTableKeyboard,
  queryResultMarkdown, statsMarkdown,
  historyMarkdown, historyKeyboard,
  exportFormatKeyboard, confirmDestructiveMarkdown,
} from "@/commands/d1.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const CF_PLUGIN = "Cloudflare";

async function getD1(ctx: TelegramContext, layer: ConnectionsLayer): Promise<D1DatabaseManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== CF_PLUGIN) {
    await ctx.replyText("No active Cloudflare connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(CF_PLUGIN);
  if (!(provider instanceof CloudflareProviderPlugin)) return null;
  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  return provider.createD1DatabaseManager(credentials);
}

export function createD1Command(layer: ConnectionsLayer): TelegramCommand {
  const handler = new D1CommandHandler(layer);
  return {
    meta: {
      name: "d1",
      description: "Cloudflare D1 Database Manager",
      aliases: ["database", "sql"],
      usage:
        "/d1 — show D1 status\n"
        + "/d1 databases — list and switch databases\n"
        + "/d1 tables — list tables\n"
        + "/d1 schema <table> — view table schema\n"
        + "/d1 query <sql> — execute SQL query\n"
        + "/d1 export [table] — export data\n"
        + "/d1 stats — database statistics\n"
        + "/d1 history — query history\n"
        + "/d1 search <query> — search schema or history",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      const args = ctx.commandArgs;
      const sub = args[0]?.toLowerCase();

      if (ctx.callbackQuery) {
        await handler.handleCallback(ctx);
        return;
      }

      switch (sub) {
        case "databases": case "dbs": await handler.databases(ctx); break;
        case "tables": await handler.tables(ctx); break;
        case "schema": case "columns": await handler.schema(ctx, args.slice(1).join(" ")); break;
        case "query": case "sql": case "run": await handler.query(ctx, args.slice(1).join(" ")); break;
        case "export": await handler.export(ctx, args[1]); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        case "history": case "log": await handler.history(ctx); break;
        case "search": case "find": await handler.search(ctx, args.slice(1).join(" ")); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class D1CommandHandler {
  private activeDb = new Map<number, string>();

  constructor(private readonly layer: ConnectionsLayer) {}

  private async getD1(ctx: TelegramContext): Promise<D1DatabaseManager | null> {
    return getD1(ctx, this.layer);
  }

  private getActiveDb(ctx: TelegramContext): string | undefined {
    const d1 = this.getD1Sync(ctx);
    if (d1) {
      const nav = d1.getNavState(ctx.user!.id);
      if (nav?.databaseId) {
        this.activeDb.set(ctx.user!.id, nav.databaseId);
        return nav.databaseId;
      }
    }
    return this.activeDb.get(ctx.user!.id);
  }

  private d1Cache = new Map<number, D1DatabaseManager>();

  private getD1Sync(ctx: TelegramContext): D1DatabaseManager | null {
    return this.d1Cache.get(ctx.user!.id) ?? null;
  }

  private cacheD1(ctx: TelegramContext, d1: D1DatabaseManager): void {
    this.d1Cache.set(ctx.user!.id, d1);
  }

  async status(ctx: TelegramContext): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);
    await ctx.sendTyping();

    try {
      const dbs = await d1.listDatabases();
      const active = this.getActiveDb(ctx);
      const db = active ? dbs.find((d) => d.uuid === active) : null;

      const lines = ["*D1 Database Manager* 🗄", ""];
      lines.push(`Databases: ${dbs.length}`);
      if (db) lines.push(`Active: \`${db.name}\` (${db.num_tables} tables, ${(db.file_size / 1024).toFixed(0)} KB)`);
      lines.push("", "Use /d1 databases to switch database.");
      lines.push("Use /d1 tables to browse tables.");
      lines.push("Use /d1 query to run SQL.");
      await ctx.replyMarkdown(lines.join("\n"), {
        reply_markup: inlineKeyboard([
          [dataButton("🗄 Databases", "d1:databases")],
          [dataButton("📋 Tables", "d1:tables")],
          [dataButton("⚡ Query", "d1:query")],
          [dataButton("📊 Stats", "d1:stats")],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async databases(ctx: TelegramContext): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);
    await ctx.sendTyping();

    try {
      const dbs = await d1.listDatabases();
      const active = this.getActiveDb(ctx);
      await ctx.replyMarkdown(databaseListMarkdown(dbs, active), {
        reply_markup: databaseSelectorKeyboard(dbs, "d1"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async tables(ctx: TelegramContext): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database. Use /d1 databases to select one."); return; }

    await ctx.sendTyping();
    try {
      const tables = await d1.listTables(dbId);
      d1.setNavState(ctx.user!.id, { userId: ctx.user!.id, databaseId: dbId, databaseName: "", view: "tables", page: 0 });
      await ctx.replyMarkdown(tableListMarkdown(tables), {
        reply_markup: tableSelectorKeyboard(tables, "d1"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async schema(ctx: TelegramContext, table: string): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }
    if (!table) { await ctx.replyText("Usage: /d1 schema <table>"); return; }

    await ctx.sendTyping();
    try {
      const columns = await d1.getTableColumns(dbId, table);
      await ctx.replyMarkdown(schemaViewMarkdown(columns, table), {
        reply_markup: schemaActionKeyboard(table, "d1"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async query(ctx: TelegramContext, sql: string): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }
    if (!sql) { await ctx.replyText("Usage: /d1 query <sql>"); return; }

    await ctx.sendTyping();
    try {
      const result = await d1.executeQuery(dbId, sql, true);
      if (result.needsConfirmation) {
        d1.setConfirmState(ctx.user!.id, { userId: ctx.user!.id, databaseId: dbId, sql, type: "destructive", startedAt: Date.now() });
        const md = confirmDestructiveMarkdown(sql);
        await ctx.replyMarkdown(md, {
          reply_markup: inlineKeyboard([
            [dataButton("⚠️ Confirm & Execute", `d1:confirm_query:${btoa(sql)}`)],
            [dataButton("Cancel", "d1:back")],
          ]),
        });
        return;
      }
      await ctx.replyMarkdown(queryResultMarkdown(result, sql), {
        reply_markup: inlineKeyboard([
          [dataButton("📥 Export", `d1:export_result:${btoa(sql)}`)],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Query failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async export(ctx: TelegramContext, table?: string): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }

    const target = table ?? "__db__";
    await ctx.replyMarkdown(`*Export* ${table ? `table \`${table}\`` : "database"} — choose format:`, {
      reply_markup: exportFormatKeyboard("d1", target),
    });
  }

  async doExport(ctx: TelegramContext, target: string, format: string): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;

    const dbId = this.getActiveDb(ctx);
    if (!dbId) return;

    await ctx.sendTyping();
    try {
      const data = target === "__db__"
        ? await d1.exportDatabase(dbId, format as "json" | "csv" | "sql")
        : await d1.exportTable(dbId, target, format as "json" | "csv" | "sql");

      const maxLen = 4000;
      const content = data.length > maxLen ? data.slice(0, maxLen) + `\n… (truncated, ${data.length} total chars)` : data;
      await ctx.replyMarkdown(`📥 *Export (${format})*\n\n\`\`\`\n${content}\n\`\`\``);
    } catch (e) {
      await ctx.replyText(`❌ Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }

    await ctx.sendTyping();
    try {
      const s = await d1.getStats(dbId);
      await ctx.replyMarkdown(statsMarkdown(s));
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async history(ctx: TelegramContext): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }

    const entries = d1.getQueryHistory(dbId);
    await ctx.replyMarkdown(historyMarkdown(entries), {
      reply_markup: historyKeyboard("d1", 0, Math.max(1, Math.ceil(entries.length / 15))),
    });
  }

  async search(ctx: TelegramContext, query: string): Promise<void> {
    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);
    if (!dbId) { await ctx.replyText("No active database."); return; }
    if (!query) { await ctx.replyText("Usage: /d1 search <query>"); return; }

    await ctx.sendTyping();
    try {
      const [schema, history] = await Promise.all([
        d1.searchSchema(dbId, query),
        Promise.resolve(d1.searchHistory(dbId, query)),
      ]);

      const lines: string[] = [`*Search: "${query}"*`, ""];

      if (schema.tables.length > 0) {
        lines.push("*Tables*", ...schema.tables.map((t) => `• \`${t.name}\``), "");
      }
      if (schema.columns.length > 0) {
        lines.push("*Columns*", ...schema.columns.slice(0, 10).map((c) => `• \`${c.table}.${c.column.name}\` (${c.column.type})`), "");
        if (schema.columns.length > 10) lines.push(`… and ${schema.columns.length - 10} more`, "");
      }
      if (history.length > 0) {
        lines.push("*History*", ...history.slice(0, 10).map((h) => `• \`${h.sql.slice(0, 60)}\``), "");
      }
      if (schema.tables.length === 0 && schema.columns.length === 0 && history.length === 0) {
        lines.push("No results found.");
      }

      await ctx.replyMarkdown(lines.join("\n"));
    } catch (e) {
      await ctx.replyText(`❌ Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  // ── Callback Handler ──

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "d1" || !parts[1]) return;
    const action = parts[1]!;

    const d1 = await this.getD1(ctx);
    if (!d1) return;
    this.cacheD1(ctx, d1);

    const dbId = this.getActiveDb(ctx);

    switch (action) {
      case "databases": await this.databases(ctx); break;
      case "tables": await this.tables(ctx); break;
      case "stats": await this.stats(ctx); break;
      case "history": await this.history(ctx); break;

      case "select": {
        const id = parts.slice(2).join(":");
        this.activeDb.set(ctx.user!.id, id);
        const dbs = await d1.listDatabases();
        const db = dbs.find((d) => d.uuid === id);
        d1.setNavState(ctx.user!.id, { userId: ctx.user!.id, databaseId: id, databaseName: db?.name ?? "", view: "tables", page: 0 });
        await ctx.answerCallback(`Selected ${db?.name ?? id}`);
        await this.tables(ctx);
        break;
      }

      case "browse": {
        if (!dbId) { await ctx.answerCallback("No database selected", true); return; }
        const table = parts[2] ?? "";
        const page = parseInt(parts[3] ?? "0");
        await ctx.sendTyping();
        try {
          const result = await d1.browseTable(dbId, table, { page });
          const totalPages = Math.ceil(result.total / result.pageSize) || 1;
          const md = browseTableMarkdown(result, table);
          const keyboard = browseTableKeyboard(table, "d1", page, totalPages);
          await ctx.editMessage(md, { reply_markup: keyboard });
        } catch (e) {
          await ctx.answerCallback(`Browse failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }

      case "schema":
      case "columns": {
        if (!dbId) return;
        const schemaTable = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const columns = await d1.getTableColumns(dbId, schemaTable);
          await ctx.editMessage(schemaViewMarkdown(columns, schemaTable), {
            reply_markup: schemaActionKeyboard(schemaTable, "d1"),
          });
        } catch { await ctx.answerCallback("Schema error", true); }
        break;
      }

      case "fks": {
        if (!dbId) return;
        const fkTable = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const fks = await d1.getForeignKeys(dbId, fkTable);
          const lines = [`*Foreign Keys: ${fkTable}*`, ""];
          for (const fk of fks) {
            lines.push(`• \`${fk.from}\` → \`${fk.table}.${fk.to}\``);
            lines.push(`  ON DELETE ${fk.on_delete} | ON UPDATE ${fk.on_update}`);
          }
          if (!fks.length) lines.push("_(none)_");
          await ctx.editMessage(lines.join("\n"), {
            reply_markup: schemaActionKeyboard(fkTable, "d1"),
          });
        } catch { await ctx.answerCallback("Error", true); }
        break;
      }

      case "indexes": {
        if (!dbId) return;
        const idxTable = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const indexes = await d1.getIndexList(dbId, idxTable);
          const lines = [`*Indexes: ${idxTable}*`, ""];
          for (const idx of indexes) {
            const detail = await d1.getIndexColumns(dbId, idx.name);
            const cols = detail.map((d) => d.name).join(", ");
            lines.push(`• \`${idx.name}\` (${idx.unique ? "UNIQUE" : ""}) → ${cols}`);
          }
          if (!indexes.length) lines.push("_(none)_");
          await ctx.editMessage(lines.join("\n"), {
            reply_markup: schemaActionKeyboard(idxTable, "d1"),
          });
        } catch { await ctx.answerCallback("Error", true); }
        break;
      }

      case "ddl": {
        if (!dbId) return;
        const ddlTable = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const ddl = await d1.getCreateStatement(dbId, ddlTable);
          await ctx.editMessage(`📄 *DDL: ${ddlTable}*\n\n\`\`\`\n${ddl ?? "-- no DDL found"}\n\`\`\``, {
            reply_markup: schemaActionKeyboard(ddlTable, "d1"),
          });
        } catch { await ctx.answerCallback("Error", true); }
        break;
      }

      case "filter": {
        await ctx.answerCallback("Use /d1 query SELECT * FROM tablename WHERE ...");
        break;
      }

      case "export": {
        const exportTable = parts.slice(2).join(":");
        await this.export(ctx, exportTable === "db" ? undefined : exportTable);
        break;
      }

      case "export_do": {
        const exportTarget = parts.slice(2, -1).join(":");
        const exportFmt = parts[parts.length - 1] ?? "json";
        await this.doExport(ctx, exportTarget, exportFmt);
        break;
      }

      case "export_result": {
        await ctx.answerCallback("Use /d1 export or copy results manually");
        break;
      }

      case "confirm_query": {
        const confirmSqlB64 = parts.slice(2).join(":");
        const confirmSql = atob(confirmSqlB64);
        if (!dbId) return;
        await ctx.sendTyping();
        try {
          const result = await d1.executeConfirmedQuery(dbId, confirmSql);
          await ctx.editMessage(queryResultMarkdown(result, confirmSql));
        } catch (e) {
          await ctx.answerCallback(`Query failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }

      case "query": {
        await ctx.answerCallback("Use /d1 query <sql>");
        break;
      }

      case "back": {
        await this.tables(ctx);
        break;
      }

      default:
        await ctx.answerCallback("Unknown action", true);
    }
  }
}
