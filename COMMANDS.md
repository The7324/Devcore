# Commands Reference

## General

| Command | Description | Aliases | Permission |
|---------|-------------|---------|------------|
| `/start` | Welcome message with bot info | — | Public |
| `/help` | Command overview and usage | `/h` | Public |
| `/ping` | Health check | — | Public |
| `/status` | System status | — | `info.view` |

## Connection Management

| Command | Description | Aliases | Permission |
|---------|-------------|---------|------------|
| `/connections` | List all connections | `/conns` | `providers.view` |
| `/connections new` | Create new connection | — | `providers.manage` |
| `/connections edit <id>` | Edit connection | — | `providers.manage` |
| `/connections delete <id>` | Delete connection | — | `providers.manage` |
| `/connections select <id>` | Set active connection | `/use` | `providers.view` |
| `/connections test <id>` | Test connection health | — | `providers.view` |

## Cloudflare

| Command | Description | Permission |
|---------|-------------|------------|
| `/cloudflare` | Cloudflare dashboard | `providers.manage` |
| `/cloudflare dns list <zone>` | List DNS records | `providers.manage` |
| `/cloudflare dns add <zone>` | Add DNS record | `providers.manage` |
| `/cloudflare dns delete <zone> <id>` | Delete DNS record | `providers.manage` |
| `/cloudflare workers list` | List Workers | `providers.manage` |
| `/cloudflare workers get <name>` | Get Worker details | `providers.manage` |
| `/cloudflare r2 list` | List R2 buckets | `providers.manage` |
| `/cloudflare r2 files <bucket>` | List files in bucket | `providers.manage` |
| `/cloudflare d1 list` | List D1 databases | `providers.manage` |
| `/cloudflare d1 query <db> <sql>` | Query D1 database | `providers.manage` |
| `/cloudflare kv list <namespace>` | List KV entries | `providers.manage` |
| `/cloudflare pages list` | List Pages projects | `providers.manage` |

## Firebase

| Command | Description | Permission |
|---------|-------------|------------|
| `/firebase` | Firebase dashboard | `providers.manage` |
| `/firestore list <collection>` | List documents | `database.manage` |
| `/firestore get <collection> <id>` | Get document | `database.manage` |
| `/firestore query <collection>` | Query collection | `database.manage` |
| `/firestore add <collection>` | Add document | `database.manage` |
| `/firestore update <collection> <id>` | Update document | `database.manage` |
| `/firestore delete <collection> <id>` | Delete document | `database.manage` |
| `/storage list` | List files | `storage.manage` |
| `/storage upload` | Upload file | `storage.manage` |
| `/storage download <path>` | Download file | `storage.manage` |
| `/storage delete <path>` | Delete file | `storage.manage` |
| `/storage search <query>` | Search files | `storage.manage` |
| `/auth list` | List auth users | `providers.manage` |
| `/auth get <uid>` | Get user details | `providers.manage` |
| `/auth create` | Create user | `providers.manage` |
| `/auth delete <uid>` | Delete user | `providers.manage` |
| `/auth set-claims <uid>` | Set custom claims | `providers.manage` |

## GitHub

| Command | Description | Permission |
|---------|-------------|------------|
| `/github` | GitHub dashboard | `providers.manage` |
| `/github repos` | List repositories | `providers.manage` |
| `/github repos <owner>` | List repos by owner | `providers.manage` |
| `/github search <query>` | Search repositories | `search.execute` |
| `/github repo <owner/name>` | Repository details | `providers.manage` |
| `/github orgs` | List organizations | `providers.manage` |

## Admin

| Command | Description | Permission |
|---------|-------------|------------|
| `/admin add <user_id>` | Add admin | `admin.manage` |
| `/admin remove <user_id>` | Remove admin | `admin.manage` |
| `/admin list` | List admins | `admin.manage` |
| `/logs` | View audit logs | `logs.view` |
| `/settings` | View settings | `settings.manage` |

## Argument Conventions

- **Spaces in values:** Use quotes: `/d1 query my-db "SELECT * FROM users"`
- **Provider connection:** Use `/connections select <id>` to set active provider
- **Help per command:** `/help <command>` (e.g., `/help firestore`)
