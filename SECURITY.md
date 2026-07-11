# Security

## Overview

DevCore handles sensitive cloud provider credentials. Security is enforced at multiple layers.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Unauthorized Telegram access | RBAC with role hierarchy |
| Credential theft at rest | AES-256-GCM encryption |
| Credential theft in transit | HTTPS only |
| Brute force via Telegram | Rate limiting |
| Privilege escalation | Strict role hierarchy |
| Session hijacking | TTL expiry, no session persistence |
| Token leakage | Tokens never logged |
| Abuse via API | Rate limiting per user |
| Supply chain | Regular dependency updates |

## Access Control

### Role Hierarchy

```
Owner (highest)
  └── Admin
       └── ReadOnly (lowest)
```

- **Owner** — All permissions, including admin management
- **Admin** — All permissions except `admin.manage`
- **ReadOnly** — View-only permissions (provider info, health checks)

### Permission Scopes

| Scope | Owner | Admin | ReadOnly |
|-------|-------|-------|----------|
| `admin.manage` | ✅ | ❌ | ❌ |
| `providers.manage` | ✅ | ✅ | ❌ |
| `providers.view` | ✅ | ✅ | ✅ |
| `database.manage` | ✅ | ✅ | ❌ |
| `storage.manage` | ✅ | ✅ | ❌ |
| `logs.view` | ✅ | ✅ | ❌ |
| `settings.manage` | ✅ | ✅ | ❌ |
| `info.view` | ✅ | ✅ | ✅ |
| `search.execute` | ✅ | ✅ | ❌ |

## Credential Storage

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** PBKDF2 with SHA-256, 100,000 iterations
- **Nonce:** Random 12 bytes per encryption
- **Storage:** Encrypted blob in D1 database

```
Plaintext → PBKDF2 → AES-256-GCM → Base64 → DB
```

### Key Management

- Encryption key from `ENCRYPTION_KEY` environment variable
- If not set, credentials are stored **unencrypted** (not recommended for production)
- Key is never logged or exposed in error messages

## Session Management

- **Storage:** In-memory (NOT persisted to database)
- **Expiry:** Configurable TTL (default 1 hour)
- **Contents:** User ID, role, provider connection
- **Lost on:** Worker restart, TTL expiry

## Rate Limiting

- **Algorithm:** Token bucket (per user)
- **Default:** 30 requests per 60-second window
- **Scope:** Per Telegram user ID
- **Storage:** In-memory (lost on restart)

## Audit Logging

All actions are logged with:
- Timestamp (ISO 8601)
- User ID and username
- Action type (command, callback, auth, security)
- Target and details
- IP address (when available)

## Security Best Practices

1. **Rotate encryption key** periodically
2. **Use separate service accounts** per environment
3. **Minimize API token permissions** (principle of least privilege)
4. **Regularly audit** `ADMIN_IDS` list
5. **Monitor audit logs** for suspicious activity
6. **Keep dependencies updated** (`npm audit` regularly)
7. **Use webhook secret** if supported by Telegram

## Reporting Vulnerabilities

See [CONTRIBUTING.md](CONTRIBUTING.md#security-reports) for responsible disclosure guidelines.
