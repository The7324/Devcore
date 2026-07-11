# Environment Reference

## Variables

### TELEGRAM_BOT_TOKEN
- **Required:** Yes
- **Type:** String
- **Description:** Telegram Bot API token from @BotFather
- **Example:** `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### OWNER_ID
- **Required:** Yes
- **Type:** Integer (string format)
- **Description:** Bot owner's Telegram user ID
- **Example:** `123456789`

### ENCRYPTION_KEY
- **Required:** No (but recommended)
- **Type:** String (64 hex chars)
- **Description:** AES-256 encryption key for credential storage
- **Generate:** `openssl rand -hex 32`
- **Example:** `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2`

### ADMIN_IDS
- **Required:** No
- **Type:** Comma-separated string
- **Description:** Additional admin Telegram user IDs
- **Example:** `987654321,555555555`

### ENVIRONMENT
- **Required:** No
- **Type:** Enum: `development`, `production`, `staging`
- **Default:** `development`
- **Description:** Runtime environment

### LOG_LEVEL
- **Required:** No
- **Type:** Enum: `DEBUG`, `INFO`, `WARN`, `ERROR`
- **Default:** `INFO`
- **Description:** Minimum log level

### RATE_LIMIT_MAX
- **Required:** No
- **Type:** Integer
- **Default:** `30`
- **Description:** Maximum requests per rate-limit window per user

### RATE_LIMIT_WINDOW_SEC
- **Required:** No
- **Type:** Integer
- **Default:** `60`
- **Description:** Rate-limit window in seconds

### SESSION_TTL_SEC
- **Required:** No
- **Type:** Integer
- **Default:** `3600`
- **Description:** Session time-to-live in seconds

## Validation

Environment variables are validated at startup using Zod schemas in `src/config/env.ts`. Invalid configurations produce clear error messages on startup.

## Cloudflare Workers Secrets

For production on Cloudflare Workers, use `wrangler secret`:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put OWNER_ID
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put ADMIN_IDS
```

Non-sensitive values go in `wrangler.toml` `[vars]`:

```toml
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "INFO"
```

## See Also

- [CONFIGURATION.md](CONFIGURATION.md) — Full configuration guide
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deploying to production
