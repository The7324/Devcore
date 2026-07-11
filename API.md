# API Reference

## Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-11T12:00:00.000Z"
}
```

### `POST /webhook`

Telegram Bot API webhook receiver.

**Request:**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": { "id": 12345, "first_name": "User", "is_bot": false },
    "chat": { "id": 12345, "type": "private" },
    "text": "/ping"
  }
}
```

**Response:** `200 OK` with empty body

### `GET /` (Root)

Redirects or returns basic info.

**Response:**
```json
{
  "name": "DevCore",
  "version": "1.0.0",
  "status": "running"
}
```

## Error Handling

All errors return structured JSON:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authorized"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | User not authenticated |
| `FORBIDDEN` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input |
| `PROVIDER_ERROR` | Provider operation failed |
| `CONNECTION_ERROR` | Connection/network issue |
| `INTERNAL_ERROR` | Unexpected error |

## Rate Limiting

Rate limit headers on all responses:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1626000000
```

## Webhook Security

The webhook endpoint validates:
- Bot token in URL path
- Request method (POST only)
- Content-Type (`application/json`)
- Body size limits

## See Also

- [COMMANDS.md](COMMANDS.md) — Telegram command reference
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment guide
