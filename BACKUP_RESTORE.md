# Backup & Restore

## D1 Database

### Export

```bash
npx wrangler d1 export devcore-db --output ./backups/devcore-$(date +%Y%m%d).sql
```

This exports all tables as SQL statements.

### Import

```bash
npx wrangler d1 execute devcore-db --file ./backups/devcore-20260711.sql
```

### Automated Backup

Add a cron trigger in `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM UTC
```

Or use GitHub Actions:

```yaml
name: Daily Backup
on:
  schedule:
    - cron: "0 2 * * *"
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: cloudflare/wrangler-action@v3
        with:
          command: d1 export devcore-db
      - uses: actions/upload-artifact@v4
        with:
          name: db-backup
          path: backup.sql
```

## Credentials

Credentials are stored encrypted in the D1 database. If you back up the database, credentials are backed up too — but they remain encrypted.

**Important:** If you rotate the `ENCRYPTION_KEY`, old backups become unrecoverable. Keep a record of which key was used for which backup period.

## Configuration

Environment variables should be backed up separately (e.g., in a password manager or secure vault).

## Migration Between Environments

```bash
# 1. Export from source
npx wrangler d1 export source-db --output ./migration.sql

# 2. Import to target
npx wrangler d1 execute target-db --file ./migration.sql
```

## Disaster Recovery

1. Deploy a fresh worker
2. Create D1 database and apply schema
3. Import latest backup
4. Set environment variables
5. Update webhook URL
