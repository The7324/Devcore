# Quick Start

Get DevCore running in under 5 minutes.

## 1. Prerequisites

- Node.js 22+
- A Telegram account
- A Cloudflare account

## 2. Clone & Install

```bash
git clone https://github.com/your-org/devcore.git
cd devcore
npm install
```

## 3. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the API token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## 4. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=your_token_here
OWNER_ID=your_telegram_user_id
ENCRYPTION_KEY=your_64_char_hex_key
```

## 5. Start Local Server

```bash
npm run dev
```

## 6. Set Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook"
```

For local testing, use a tool like [ngrok](https://ngrok.com/):
```bash
ngrok http 8787
# Then set webhook to https://xxxx.ngrok.io/webhook
```

## 7. Test It

Open Telegram, find your bot, and send:

```
/start
/ping
/help
```

## 8. Add a Provider

```
/connections new
```

Select a provider (Cloudflare, Firebase, GitHub) and follow the wizard to add credentials.

## 9. Explore

```
/cloudflare dns list example.com
/firebase auth list
/github repos
```

## Next Steps

- [INSTALLATION.md](INSTALLATION.md) — Full installation guide
- [COMMANDS.md](COMMANDS.md) — All available commands
- [CONFIGURATION.md](CONFIGURATION.md) — Configuration reference
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment
