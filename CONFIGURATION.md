# Configuration

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Telegram Bot API token |
| `OWNER_ID` | ✅ | — | Bot owner's Telegram user ID |
| `ENCRYPTION_KEY` | ❌ | — | 64-char hex AES-256 key (auto-generated if missing, insecure) |
| `ENVIRONMENT` | ❌ | `development` | Runtime environment (`development`, `production`, `staging`) |
| `LOG_LEVEL` | ❌ | `INFO` | Logging level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `ADMIN_IDS` | ❌ | — | Comma-separated admin Telegram user IDs |
| `RATE_LIMIT_MAX` | ❌ | `30` | Max requests per window per user |
| `RATE_LIMIT_WINDOW_SEC` | ❌ | `60` | Rate limit window in seconds |
| `SESSION_TTL_SEC` | ❌ | `3600` | Session TTL in seconds |

## Cloudflare D1 Database

Configure in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "devcore-db"
database_id = "your-database-id"
```

Migrations are in `src/database/migrations/` and run automatically on first load.

## Provider Credentials

Credentials are stored encrypted (AES-256-GCM) in the D1 database. Each provider requires:

### Cloudflare
- `api_token` — Cloudflare API token with appropriate permissions

### Firebase
- `type`, `project_id`, `private_key_id`, `private_key`, `client_email`, `client_id`, `auth_uri`, `token_uri`, `auth_provider_x509_cert_url`, `client_x509_cert_url` — Firebase service account JSON

### GitHub
- `token` — GitHub personal access token (classic or fine-grained)
- `username` — GitHub username

## Rate Limiting

Token-bucket algorithm with configurable:
- `RATE_LIMIT_MAX` — bucket capacity (max burst)
- `RATE_LIMIT_WINDOW_SEC` — refill period

## Sessions

In-memory session store with TTL expiry. Lost on worker restart. Configure with `SESSION_TTL_SEC`.

## Logging

Structured JSON logging. Levels:
- `DEBUG` — detailed debugging info
- `INFO` — normal operations
- `WARN` — concerning but non-critical
- `ERROR` — operational failures

## See Also

- [ENVIRONMENT.md](ENVIRONMENT.md) — Detailed environment variable reference
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment guide
