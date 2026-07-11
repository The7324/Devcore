# Deployment

## Cloudflare Workers (Recommended)

### Prerequisites

- Wrangler CLI installed: `npm install -g wrangler`
- Logged in: `wrangler login`
- D1 database created: `npx wrangler d1 create devcore-db`

### Configure

Edit `wrangler.toml` if needed:

```toml
name = "devcore"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[[d1_databases]]
binding = "DB"
database_name = "devcore-db"
database_id = "your-database-id"

[vars]
ENVIRONMENT = "production"
```

### Set Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put OWNER_ID
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put ADMIN_IDS
```

### Deploy

```bash
npm run deploy
```

### Verify

```bash
curl https://devcore.your-account.workers.dev/health
# → {"status":"ok","timestamp":"2026-07-11T..."}
```

### Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://devcore.your-account.workers.dev/webhook"
```

---

## Docker

### Build Image

```bash
docker build -t devcore .
```

### Run Container

```bash
docker run -d \
  --name devcore \
  -p 8787:8787 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e OWNER_ID=your_id \
  -e ENCRYPTION_KEY=your_key \
  devcore
```

### Docker Compose

```yaml
version: "3.8"
services:
  devcore:
    build: .
    ports:
      - "8787:8787"
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - OWNER_ID=${OWNER_ID}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ENVIRONMENT=production
```

Then:

```bash
docker-compose up -d
```

---

## Production Checklist

- [ ] Encryption key generated and set
- [ ] Admin IDs configured
- [ ] D1 database created and migrations applied
- [ ] Webhook URL set correctly
- [ ] Rate limiting configured appropriately
- [ ] Logging level set to `INFO` or `WARN`
- [ ] Health endpoint monitored
- [ ] Session TTL configured
- [ ] Audit logging enabled
