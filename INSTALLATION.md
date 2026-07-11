# Installation

## Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Cloudflare Workers account** (for deployment)
- **Telegram Bot Token** (from @BotFather)
- **Wrangler CLI** >= 3 (`npm install -g wrangler`)

## Clone & Install

```bash
git clone https://github.com/your-org/devcore.git
cd devcore
npm install
```

## Configure

```bash
cp .env.example .env
```

Edit `.env`:
- `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
- `OWNER_ID` — your Telegram user ID (ask @userinfobot)
- `ENCRYPTION_KEY` — `openssl rand -hex 32`

## Verify Setup

```bash
# Type check
npm run typecheck

# Run tests
npm test

# Build
npm run build
```

## Local Development

```bash
npm run dev
```

This starts the Wrangler dev server at `http://localhost:8787`. Point your Telegram bot's webhook to `https://your-domain.com/webhook` using:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook"
```

## Docker

See [DEPLOYMENT.md](DEPLOYMENT.md#docker) for Docker-based installation.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
