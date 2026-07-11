# Troubleshooting

## Bot Not Responding

**Symptoms:** Bot never replies to messages.

**Check:**
1. Is the webhook set correctly?
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
2. Is the worker deployed and healthy?
   ```bash
   curl https://your-worker.workers.dev/health
   ```
3. Check Cloudflare Workers logs in the dashboard.

## "User not authorized"

**Symptoms:** `/start` works but commands fail with authorization errors.

**Check:**
1. Is `OWNER_ID` set correctly? (must be a numeric string)
2. Are you the owner? Check your ID with @userinfobot.
3. For additional admins, add IDs to `ADMIN_IDS` as comma-separated.

## Connection Validation Fails

**Symptoms:** Adding a new connection fails validation.

**Check:**
1. Are the credentials correct? Test them in the provider's dashboard.
2. Does the API token have the correct permissions?
3. For Firebase: ensure the service account JSON is complete and valid.
4. For GitHub: ensure the token has the required scopes.

## Rate Limited

**Symptoms:** Getting "Rate limited" responses.

**Check:**
1. Wait for the rate limit window to reset.
2. Adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_SEC` if needed.
3. The rate limit is per user, not global.

## "Internal Server Error"

**Symptoms:** Commands fail with "Something went wrong."

**Check:**
1. Check Cloudflare Workers logs for the error stack trace.
2. Verify environment variables are set correctly.
3. Check D1 database is created and migrations are applied.

## D1 Database Issues

**Symptoms:** Database-related commands fail.

**Check:**
```bash
# Verify D1 database exists
npx wrangler d1 list

# Apply migrations
npx wrangler d1 migrations apply devcore-db

# Verify database ID in wrangler.toml matches
```

## Encryption Issues

**Symptoms:** "Failed to decrypt credentials" errors.

**Check:**
1. Was `ENCRYPTION_KEY` changed after credentials were stored?
2. Credentials encrypted with one key cannot be decrypted with another.
3. Delete and re-add connections if key was rotated.

## Webhook Errors

**Symptoms:** Telegram reports "Bad Request: wrong URL"

**Check:**
1. URL must be HTTPS (except for local testing).
2. URL must point to the correct path: `https://your-host/webhook`
3. For local testing, use ngrok or similar tunneling service.

## Still Stuck?

Open a [GitHub Issue](https://github.com/your-org/devcore/issues) with:
- Error message (full text)
- Steps to reproduce
- Environment details (deployment type, Node version)
- Relevant logs
