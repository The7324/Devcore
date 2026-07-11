import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ponytail: placeholder schema, extend as providers are added
export const migrations = sqliteTable("migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  appliedAt: text("applied_at").notNull().$defaultFn(() => new Date().toISOString()),
});
