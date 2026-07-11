# Database Reference

## Overview

DevCore uses **Cloudflare D1** (serverless SQLite) with **Drizzle ORM** for type-safe database access.

## Tables

### `connections`

Stores provider connections with encrypted credentials.

```sql
CREATE TABLE connections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  credentials TEXT NOT NULL,  -- AES-256-GCM encrypted JSON
  created_by  TEXT NOT NULL,  -- Telegram user ID
  created_at  TEXT NOT NULL,  -- ISO 8601
  updated_at  TEXT NOT NULL,  -- ISO 8601
  is_active   INTEGER DEFAULT 1
);
```

### `connection_tags`

Tags for filtering and organizing connections.

```sql
CREATE TABLE connection_tags (
  id            TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL
);
```

### `connection_groups`

Groups for organizing multiple connections.

```sql
CREATE TABLE connection_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

### `connection_group_members`

Many-to-many relationship between groups and connections.

```sql
CREATE TABLE connection_group_members (
  group_id      TEXT NOT NULL REFERENCES connection_groups(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, connection_id)
);
```

### `active_connections`

Per-user active connection tracking.

```sql
CREATE TABLE active_connections (
  user_id       TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  activated_at  TEXT NOT NULL
);
```

### `connection_logs`

Audit trail for all connection operations.

```sql
CREATE TABLE connection_logs (
  id            TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES connections(id),
  user_id       TEXT NOT NULL,
  username      TEXT,
  action        TEXT NOT NULL,  -- create, read, update, delete, test
  target        TEXT,
  details       TEXT,           -- JSON metadata
  ip_address    TEXT,
  created_at    TEXT NOT NULL
);
```

### `migrations`

Tracks applied database migrations.

```sql
CREATE TABLE migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  applied_at  TEXT NOT NULL
);
```

## Drizzle ORM Schema

```typescript
// src/database/schema/index.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  credentials: text("credentials").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});
```

## Migrations

Migrations are in `src/database/migrations/`. Apply with:

```bash
npx wrangler d1 migrations apply devcore-db
```

## Queries

```typescript
import { eq } from "drizzle-orm";
import { connections } from "../database/schema";

// Find connection
const conn = await db
  .select()
  .from(connections)
  .where(eq(connections.id, id))
  .get();
```

## See Also

- [ENVIRONMENT.md](ENVIRONMENT.md) — Database environment configuration
- [ARCHITECTURE.md](ARCHITECTURE.md) — Architecture overview
