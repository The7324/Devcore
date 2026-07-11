# FAQ

## General

### What is DevCore?
DevCore is a Telegram-based DevOps platform that lets you manage cloud services (Cloudflare, Firebase, GitHub) directly from Telegram chat.

### Who is it for?
DevOps engineers, SREs, and developers who want to manage infrastructure from their phone without opening a browser.

### Do I need a Cloudflare account?
Yes, if you want to deploy on Cloudflare Workers. You can also run locally or via Docker.

## Security

### Are my credentials safe?
Yes. Credentials are encrypted with AES-256-GCM before storage. The encryption key is never exposed in logs or error messages.

### Can other Telegram users see my data?
No. The bot only responds to authorized users. Role-based access control ensures users only see what they're permitted to.

### What happens if someone gets my bot token?
They could impersonate your bot. Use the `setWebhook` API to change the webhook URL and regenerate the token from @BotFather.

## Technical

### What if Cloudflare Workers has a cold start?
Cold starts are typically <50ms. Subsequent requests are fast. Sessions are in-memory so they reset on cold starts, but connections to providers are re-established on demand.

### Can I add my own provider?
Yes. See [PLUGINS.md](PLUGINS.md) for the plugin development guide.

### Does it work with group chats?
The bot works in private chats. Group chat support is not a current priority but may be added.

### Can I use it with multiple Cloudflare accounts?
Yes. Create multiple connections with different API tokens and switch between them with `/connections select <id>`.

### What if D1 reaches its limits?
D1 has generous limits (5M rows per database, 100 GB storage). For high-scale usage, consider purging old audit logs and connections.

## Troubleshooting

### The bot doesn't respond to my commands
Check the webhook is set correctly: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

### I can't connect my Firebase project
Make sure the service account JSON is complete and the Firebase project has the relevant APIs enabled (Firestore, etc.).

### I'm getting rate limited
The default limit is 30 requests per 60 seconds per user. Wait a minute or adjust `RATE_LIMIT_MAX`.

### How do I reset everything?
Delete the D1 database and create a new one, or drop all tables manually.
