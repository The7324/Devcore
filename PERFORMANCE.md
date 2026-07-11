# Performance

## Overview

DevCore runs on Cloudflare Workers, designed for low-latency edge execution.

## Key Metrics

| Metric | Target | Measured |
|--------|--------|----------|
| Cold start | <100ms | ~50ms |
| Warm request (no provider) | <10ms | ~5ms |
| Provider API call | <500ms | Varies |
| Database query | <20ms | ~10ms |
| Encryption/decryption | <10ms | ~3ms |
| Rate limit check | <1ms | ~0.5ms |

## Optimization Strategies

### Provider Client Reuse
Provider clients are cached per request to avoid redundant authentication.

### Minimal Dependencies
Hono and Drizzle are lightweight. No heavy frameworks.

### Lazy Initialization
Sessions, rate limiters, and provider connections are created on demand.

### In-Memory Caching
Sessions and rate limit state are in-memory (not D1) to avoid database latency.

### Streaming Where Possible
Some Telegram API calls can be streamed.

## Bottlenecks

### D1 Database
D1 is fast but has higher latency than in-memory storage. Keep hot paths out of D1:
- Sessions: in-memory ✅
- Rate limiting: in-memory ✅
- Audit logs: D1 (acceptable for async writes) ❌ → change to batch writes if needed
- Provider credentials: D1 with in-memory cache ✅

### Telegram API
Telegram Bot API calls add 100-500ms per request. Minimize by:
- Using inline keyboards (single update, multiple actions)
- Batching messages when possible
- Using `sendChatAction` for long operations

### Provider APIs
Third-party API calls (Cloudflare, Firebase, GitHub) are the slowest path:
- Timeout after 10 seconds
- Cache responses when possible
- Show progress indicators for long operations

## Monitoring

Track performance via:
- Cloudflare Workers dashboard (request duration, CPU time)
- Logged request durations
- Health check endpoint (`/health`)
