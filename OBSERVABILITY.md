# Observability

## Logging

DevCore uses structured JSON logging with configurable levels.

### Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Detailed diagnostic information |
| `INFO` | Normal operational events (commands, auth) |
| `WARN` | Concerning situations (rate limit approaching, expired sessions) |
| `ERROR` | Operational failures (provider errors, validation failures) |

### Log Format

```json
{
  "timestamp": "2026-07-11T12:00:00.000Z",
  "level": "INFO",
  "module": "github-manager",
  "message": "Listed repositories",
  "userId": "12345",
  "connectionId": "abc-123",
  "count": 5,
  "duration": 342
}
```

### Viewing Logs

**Cloudflare Workers:**
```bash
wrangler tail --format json
```

**Local development:**
Logs are printed to stdout in the configured format.

## Health Checks

### Endpoint

`GET /health`

```json
{
  "status": "ok",
  "timestamp": "2026-07-11T12:00:00.000Z"
}
```

### Provider Health

Each connection can be tested with `/connections test <id>`. Returns:

```json
{
  "status": "healthy",
  "timestamp": "2026-07-11T12:00:00.000Z",
  "latency": 345,
  "details": {
    "projectId": "my-project",
    "services": ["firestore", "auth"]
  }
}
```

## Audit Logs

All command and connection operations are logged to the `connection_logs` table.

View with `/logs` (requires `logs.view` permission).

### Audit Events

| Action | Description |
|--------|-------------|
| `command` | Command execution |
| `callback` | Inline keyboard callback |
| `auth.login` | User authentication |
| `auth.logout` | Session end |
| `auth.denied` | Authorization denied |
| `connection.create` | New connection added |
| `connection.update` | Connection modified |
| `connection.delete` | Connection removed |
| `connection.test` | Connection tested |
| `security.rate_limited` | User rate limited |
| `security.encryption_error` | Encryption/decryption failure |

## Monitoring Recommendations

### Key Metrics to Track

1. **Request rate** — commands per minute
2. **Error rate** — failed operations / total operations
3. **Provider API latency** — time to respond from Cloudflare/Firebase/GitHub
4. **Rate limit hits** — how often users hit rate limits
5. **Audit log volume** — storage growth rate

### Suggested Alerts

- Error rate > 5% in 5-minute window
- Provider health check failure
- Encryption errors (potential key issue)
- D1 database approaching storage limits
- Rate limit saturation (>80% of capacity)
