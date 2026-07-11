# Architecture

## Overview

DevCore is a Telegram-native DevOps platform built on **Cloudflare Workers**. It uses a layered architecture with dependency injection, a plugin-based provider system, and role-based access control. The entire system runs serverlessly at the edge.

---

## Core Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Hono HTTP Server                        │  │
│  │  (src/index.ts → src/app.ts → Cloudflare Workers fetch)   │  │
│  │                                                            │  │
│  │  GET /health      → Health check                           │  │
│  │  POST /webhook    → Telegram bot updates                    │  │
│  └───────────┬────────────────────────────────────────────────┘  │
│              │                                                    │
│  ┌───────────▼────────────────────────────────────────────────┐  │
│  │                    Application Layers                       │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │  │
│  │  │   Auth   │ │  Router  │ │Middleware│ │  Logger  │     │  │
│  │  │  Layer   │ │ (Command)│ │  Stack   │ │  System  │     │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │              Connections Layer                      │    │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │    │  │
│  │  │  │  Connection  │ │  Credential  │ │  Provider  │ │    │  │
│  │  │  │   Manager    │ │   Manager    │ │  Registry  │ │    │  │
│  │  │  └──────────────┘ └──────────────┘ └────────────┘ │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │              Provider Plugins                       │    │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │  │
│  │  │  │Cloudflare│ │ Firebase │ │  GitHub  │           │    │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘           │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │              Database (D1 via Drizzle)              │    │  │
│  │  │  connections │ connection_logs │ active_connections │    │  │
│  │  │  connection_tags │ connection_groups │ migrations  │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### 1. HTTP Layer (`src/app.ts`, `src/index.ts`)

- **Framework:** Hono v4 (lightweight, fast, Cloudflare-optimized)
- **Entry Point:** `src/index.ts` — the Cloudflare Worker's `fetch` handler
- **App Setup:** `src/app.ts` — creates Hono app, attaches middleware, registers health endpoint
- **Endpoints:**
  - `GET /health` — returns `{ status: "ok", timestamp }`
  - `POST /webhook` — receives Telegram updates

### 2. Telegram Layer (`src/telegram/`)

- **Router:** `TelegramRouter` — registers commands, dispatches updates through middleware chain
- **Context:** `TelegramContext` — wraps each update with reply helpers, user/chat info, callback data
- **Webhook:** `createWebhookHandler()` — parses incoming updates, extracts bot token from URL
- **Sender:** `TelegramSender` — makes Telegram Bot API calls
- **Buttons:** `inlineKeyboard()`, `dataButton()` — builders for inline keyboards

**Command Registration Pattern:**
```typescript
router.register({
  meta: { name: "example", description: "...", aliases: ["ex"] },
  permissions: [Permission.SomeScope],
  async handle(ctx) {
    if (ctx.callbackQuery) return handler.handleCallback(ctx);
    // handle text command
  },
});
```

### 3. Auth Layer (`src/auth/`)

- **UserStore:** In-memory store of known Telegram users with roles
- **SessionManager:** TTL-based sessions with in-memory storage
- **Role Hierarchy:** Owner → Admin → ReadOnly
- **AccessControl:** Checks if a user's role grants required permissions
- **RateLimiter:** Token-bucket algorithm per user
- **AuditLogger:** Logs commands, callbacks, auth events, security events
- **Encryption:** AES-256-GCM with PBKDF2 key derivation
- **Middleware:** Authentication, Authorization, RateLimit, Audit middlewares

**Permission Scopes:**
| Permission | Description |
|------------|-------------|
| `admin.manage` | Manage administrators |
| `providers.manage` | Manage provider connections |
| `providers.view` | View provider connections |
| `database.manage` | Manage databases |
| `storage.manage` | Manage storage |
| `logs.view` | View audit logs |
| `settings.manage` | Manage settings |
| `info.view` | View system info |
| `search.execute` | Execute searches |

### 4. Connections Layer (`src/connections/`)

- **ConnectionManager:** CRUD for connections, active connection tracking, health checks
- **CredentialManager:** AES-256-GCM encrypt/decrypt for credentials
- **ProviderRegistry:** Maps provider names to plugin instances
- **HealthTracker:** Records health check results, tracks failures
- **ConnectionWizard:** Step-by-step connection creation flow

### 5. Provider Plugins (`src/providers/`)

Each provider implements:

```typescript
interface ProviderPlugin {
  meta: ProviderMeta;           // name, version, icon, capabilities, credential schema
  validate(credentials): Promise<{ valid, errors? }>;
  test(credentials): Promise<HealthStatus>;
  // Optional: getMetadata(), createXxxManager()
}
```

**Current Providers:**

| Provider | Capabilities |
|----------|-------------|
| **Cloudflare** | DNS, Workers, R2 (S3-compatible storage), D1 (SQLite), KV, Pages, Cache, Analytics, Stream, AI, Zero Trust, Email Routing |
| **Firebase** | Firestore (NoSQL queries, CRUD, export), Storage (file manager, upload, search), Auth (user CRUD, claims, stats) |
| **GitHub** | Repositories (list, detail, search), Organizations, Permissions, Capability detection |

### 6. Database Layer (`src/database/`)

- **ORM:** Drizzle ORM with SQLite dialect
- **Database:** Cloudflare D1 (serverless SQLite)
- **Tables:**
  - `connections` — Provider connection store with encrypted credentials
  - `connection_tags` — Tags for filtering connections
  - `connection_groups` — Grouping connections
  - `connection_group_members` — M2M group membership
  - `active_connections` — Per-user active connection
  - `connection_logs` — Audit trail
  - `migrations` — Schema version tracking

### 7. Core Framework (`src/core/`)

- **Logger:** Structured JSON logger with log levels (DEBUG, INFO, WARN, ERROR)
- **ConfigManager:** Loads and provides typed configuration
- **DI Container:** Simple service container
- **Error Handler:** Global error handling middleware
- **Plugin Loader:** Dynamic plugin loading infrastructure
- **Middleware Stack:** Composable middleware pipeline
- **Env Validator:** Zod schema for environment variable validation
- **Command Router:** HTTP request routing by command pattern

---

## Data Flow: Telegram Command

```
User sends /github repos
    │
    ▼
Cloudflare Worker receives POST /webhook
    │
    ▼
Hono routes to webhook handler
    │
    ▼
TelegramRouter.parseUpdate() → TelegramContext
    │
    ▼
Auth Middleware Chain (auth → authorize → rate-limit → audit)
    │
    ▼
GitHubCommand.handle(ctx)
    │
    ▼
GitHubManager.getRepositories()
    │
    ▼
GitHubClient.getUserRepositories() → GitHub API
    │
    ▼
Command formats reply via UI helpers
    │
    ▼
TelegramSender.sendMessage() → Telegram Bot API → User
```

## Data Flow: Connection Validation

```
User adds Firebase connection
    │
    ▼
FirebaseProviderPlugin.validate(credentials)
    │
    ├─ checkCredentialFormat() — syntactic validation
    │
    ├─ FirebaseClient.getAccessToken() — JWT → OAuth2 token
    │
    ├─ FirebaseClient.getProjectInfo() — verify project exists
    │
    └─ Return { valid: true/false, errors? }
```

---

## Security Architecture

```
┌─────────────────────┐
│   Telegram User     │
└────────┬────────────┘
         │
┌────────▼────────────┐
│ Authentication MW   │  ← Verifies user exists in UserStore
└────────┬────────────┘
         │
┌────────▼────────────┐
│ Authorization MW    │  ← Checks role permissions
└────────┬────────────┘
         │
┌────────▼────────────┐
│ Rate Limit MW       │  ← Token-bucket per user
└────────┬────────────┘
         │
┌────────▼────────────┐
│ Audit MW            │  ← Logs command to audit trail
└────────┬────────────┘
         │
         ▼
    Command Handler
```

---

## Dependency Graph

```
index.ts
  ├── app.ts
  │   ├── Hono
  │   ├── Logger
  │   ├── ConfigManager
  │   ├── CommandRouter
  │   ├── PluginLoader
  │   └── MiddlewareStack
  ├── auth/
  │   ├── types.ts
  │   ├── user-store.ts
  │   ├── session.ts
  │   ├── access.ts
  │   ├── rate-limit.ts
  │   ├── audit.ts
  │   ├── encrypt.ts
  │   ├── roles.ts
  │   └── middleware.ts
  ├── connections/
  │   ├── types.ts
  │   ├── connection.manager.ts
  │   ├── credential.manager.ts
  │   ├── provider.registry.ts
  │   ├── health.ts
  │   └── wizard.ts
  ├── providers/
  │   ├── index.ts
  │   ├── cloudflare/plugin.ts
  │   ├── firebase/plugin.ts
  │   └── github/plugin.ts
  ├── telegram/
  │   ├── router.ts
  │   ├── context.ts
  │   ├── sender.ts
  │   ├── webhook.ts
  │   └── buttons.ts
  └── database/
      └── schema/index.ts
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Cloudflare Workers** | Edge deployment, zero cold starts after first request, D1 for persistence |
| **Hono** | Lightweight, fast, Cloudflare-native, middleware support |
| **Drizzle ORM** | Type-safe SQL, lightweight, D1 support, no runtime dependencies |
| **In-memory sessions** | D1 latency is too high for per-request session lookups; sessions are ephemeral |
| **AES-256-GCM** | Industry standard, Web Crypto API available in Workers |
| **Provider Plugin pattern** | Clean separation, easy to add new providers, consistent interface |
| **Telegram as UI** | Zero frontend code, cross-platform, real-time, notifications built-in |
