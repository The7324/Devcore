import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ponytail: placeholder schema, extend as providers are added
export const migrations = sqliteTable("migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  appliedAt: text("applied_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  encryptedCredentials: text("encrypted_credentials").notNull(),
  status: text("status", { enum: ["active", "inactive", "error"] }).notNull().default("active"),
  health: text("health", { enum: ["healthy", "warning", "error", "unknown"] }).notNull().default("unknown"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastValidatedAt: text("last_validated_at"),
  lastUsedAt: text("last_used_at"),
  ownerId: integer("owner_id").notNull(),
  environment: text("environment").notNull().default("production"),
  region: text("region").notNull().default(""),
  color: text("color").notNull().default("#6b7280"),
  icon: text("icon").notNull().default("🔌"),
  version: integer("version").notNull().default(1),
  metadata: text("metadata").notNull().default("{}"),
});

export const connectionTags = sqliteTable("connection_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  connectionId: text("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

export const connectionGroups = sqliteTable("connection_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const connectionGroupMembers = sqliteTable("connection_group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: text("group_id").notNull().references(() => connectionGroups.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
});

export const activeConnections = sqliteTable("active_connections", {
  userId: integer("user_id").primaryKey(),
  connectionId: text("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  activatedAt: text("activated_at").notNull(),
});

export const connectionLogs = sqliteTable("connection_logs", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull().default("{}"),
  timestamp: text("timestamp").notNull(),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
});
