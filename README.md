# DevCore

**A Telegram-based DevOps platform for managing cloud services — Cloudflare, Firebase, and GitHub — all from your chat.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4.6-blueviolet)](https://hono.dev/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-yellow)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE.md)

---

## Overview

DevCore turns Telegram into a DevOps control panel. Manage cloud providers, databases, storage, authentication, and infrastructure — all through simple chat commands.

### Features

- **Multi-Provider Plugin System** — Cloudflare, Firebase, GitHub (extensible architecture)
- **Connection Manager** — Securely store and switch between multiple provider credentials
- **Role-Based Access Control** — Owner, Admin, ReadOnly roles with fine-grained permissions
- **Repository Management** — Browse, search, and manage GitHub repositories
- **Database Explorer** — Query and browse Firebase Firestore and Cloudflare D1
- **Storage Manager** — Upload, download, browse, and search Firebase Cloud Storage
- **Auth Management** — Manage Firebase Authentication users (CRUD, claims, search)
- **Credential Encryption** — AES-256-GCM encrypted credential storage
- **Audit Logging** — Full audit trail for all connection and command actions
- **Health Monitoring** — Real-time health checks for all provider connections
- **Rate Limiting** — Token-bucket rate limiter per user
- **Session Management** — TTL-based session expiry
- **Inline Keyboards** — Rich interactive Telegram UI with inline keyboards

### Screenshots

> *Screenshots coming soon. The Telegram interface provides rich inline keyboards, markdown messages, and interactive callbacks for all operations.*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Chat / Bot API                    │
└────────────────────────┬────────────────────────────────────┘
                         │ Webhook
┌────────────────────────▼────────────────────────────────────┐
│                    Hono HTTP Server                          │
│  (Cloudflare Workers — src/index.ts → src/app.ts)           │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Auth     │ Router   │ Middleware│ Logger   │ Config          │
│ Layer    │ (Command)│ Stack    │ System   │ Manager         │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                  Connections Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Connection  │  │ Credential   │  │ Provider          │  │
│  │ Manager     │  │ Manager      │  │ Registry          │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Provider Plugins                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Cloudflare   │  │ Firebase     │  │ GitHub       │      │
│  │ ☁️           │  │ 🔥           │  │ 📦           │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ • DNS        │  │ • Firestore  │  │ • Repos      │      │
│  │ • Workers    │  │ • Storage    │  │ • Orgs       │      │
│  │ • R2         │  │ • Auth       │  │ • Search     │      │
│  │ • D1         │  │ • Realtime   │  │ • Capabilities│     │
│  │ • KV/Pages   │  │ • Functions  │  │ • Permissions │     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
devcore/
├── src/
│   ├── index.ts              # Worker entry point
│   ├── app.ts                # Hono app setup
│   ├── auth/                 # RBAC, sessions, rate limiting
│   ├── commands/             # Telegram command handlers
│   ├── config/               # Configuration manager
│   ├── connections/          # Connection & credential management
│   ├── constants/            # Shared constants
│   ├── core/                 # Core framework (logger, DI, errors)
│   ├── database/             # Drizzle ORM schema & migrations
│   ├── middleware/           # HTTP middleware
│   ├── providers/            # Provider plugins
│   │   ├── cloudflare/       # Cloudflare provider
│   │   ├── firebase/         # Firebase provider
│   │   └── github/           # GitHub provider
│   ├── telegram/             # Telegram bot framework
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── .github/workflows/        # CI/CD pipelines
├── vitest.config.ts          # Test configuration
├── wrangler.toml             # Cloudflare Workers config
└── package.json
```

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/The7324/Devcore.git
cd devcore
npm install

# Configure environment
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN and OWNER_ID

# Start development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

See [QUICK_START.md](QUICK_START.md) for a detailed walkthrough.

---

## Installation

Detailed installation guides for all platforms:

| Platform | Guide |
|----------|-------|
| **Cloudflare Workers** | [DEPLOYMENT.md](DEPLOYMENT.md#cloudflare-workers) |
| **Docker** | [DEPLOYMENT.md](DEPLOYMENT.md#docker) |
| **Local Development** | [INSTALLATION.md](INSTALLATION.md) |
| **Production** | [DEPLOYMENT.md](DEPLOYMENT.md#production-deployment) |

---

## Configuration

All configuration is via environment variables (Cloudflare Workers bindings).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Telegram bot API token |
| `OWNER_ID` | ✅ | — | Telegram user ID of bot owner |
| `ENCRYPTION_KEY` | ❌ | — | AES encryption key for credentials |
| `ADMIN_IDS` | ❌ | — | Comma-separated admin user IDs |
| `ENVIRONMENT` | ❌ | `development` | Runtime environment |
| `LOG_LEVEL` | ❌ | `INFO` | Logging level |
| `RATE_LIMIT_MAX` | ❌ | `30` | Max requests per window |
| `RATE_LIMIT_WINDOW_SEC` | ❌ | `60` | Rate limit window (seconds) |
| `SESSION_TTL_SEC` | ❌ | `3600` | Session expiry (seconds) |

See [CONFIGURATION.md](CONFIGURATION.md) and [ENVIRONMENT.md](ENVIRONMENT.md) for details.

---

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/start` | Welcome message | Public |
| `/help` | Help overview | Public |
| `/ping` | Health check | Public |
| `/connections` | Manage provider connections | `providers.view` |
| `/cloudflare` | Cloudflare management | `providers.manage` |
| `/firebase` | Firebase management | `providers.manage` |
| `/github` | GitHub repository management | `providers.manage` |
| `/firestore` | Firestore database browser | `providers.manage` |
| `/storage` | Cloud Storage file manager | `providers.manage` |
| `/auth` | Firebase Auth user manager | `providers.manage` |
| `/r2` | Cloudflare R2 storage | `providers.manage` |
| `/d1` | Cloudflare D1 database | `providers.manage` |

See [COMMANDS.md](COMMANDS.md) for complete reference.

---

## Plugin System

DevCore uses a plugin-based provider architecture. Each provider implements the `ProviderPlugin` interface:

```typescript
interface ProviderPlugin {
  meta: ProviderMeta;
  validate(credentials: Record<string, string>): Promise<{ valid: boolean; errors?: string[] }>;
  test(credentials: Record<string, string>): Promise<HealthStatus>;
}
```

| Provider | Services | Status |
|----------|----------|--------|
| **Cloudflare** | DNS, Workers, R2, D1, KV, Pages, Cache, Analytics, Stream, AI | ✅ |
| **Firebase** | Firestore, Storage, Auth, Realtime DB, Functions, Hosting, FCM | ✅ |
| **GitHub** | Repositories, Orgs, Search, Capabilities, Permissions | ✅ |

See [PLUGINS.md](PLUGINS.md) for the complete plugin development guide.

---

## Security

- Credentials encrypted with AES-256-GCM before storage
- Role-based access control (Owner, Admin, ReadOnly)
- Rate limiting prevents abuse
- Session management with configurable TTL
- Audit logging for all actions
- Tokens never logged or exposed
- See [SECURITY.md](SECURITY.md) for full threat model

---

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Verify deployment
curl https://your-worker.example.com/health
# → {"status":"ok","timestamp":"2026-07-11T..."}
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guides.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE.md)

---

## Support

- Documentation: Full docs in the `docs/` directory
- Issues: [GitHub Issues](https://github.com/The7324/Devcore/issues)
- Security: See [SECURITY.md](SECURITY.md) for responsible disclosure

---

## Roadmap

- Version 1.0: Issues, PRs, Actions, and Packages management for GitHub
- Version 1.1: Cloudflare Workers editor and D1 query builder UI
- Version 1.2: Multi-language support and web dashboard
- See [ROADMAP.md](ROADMAP.md) for details
