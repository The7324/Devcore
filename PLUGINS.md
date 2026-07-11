# Plugin System

## Overview

DevCore uses a plugin-based provider architecture. Each provider (Cloudflare, Firebase, GitHub) is a self-contained plugin implementing the `ProviderPlugin` interface.

## Interface

```typescript
interface ProviderPlugin {
  /** Plugin metadata */
  meta: ProviderMeta;

  /** Validate credentials format */
  validate(
    credentials: Record<string, string>
  ): Promise<{ valid: boolean; errors?: string[] }>;

  /** Test connectivity with credentials */
  test(
    credentials: Record<string, string>
  ): Promise<HealthStatus>;
}

interface ProviderMeta {
  /** Unique provider ID (e.g., "cloudflare") */
  id: string;
  /** Display name */
  name: string;
  /** Emoji icon */
  icon: string;
  /** Version string */
  version: string;
  /** Description */
  description: string;
  /** Credential field definitions for UI */
  credentialSchema: CredentialField[];
  /** Available capabilities (e.g., ["dns", "workers", "r2"]) */
  capabilities: string[];
}
```

## Creating a Plugin

### 1. Create Directory

```
src/providers/your-provider/
├── plugin.ts
├── types.ts
├── client.ts
└── __tests__/
    └── plugin.test.ts
```

### 2. Implement Plugin

```typescript
// src/providers/your-provider/plugin.ts
import { ProviderPlugin, ProviderMeta, HealthStatus } from "../../types";

export class YourProviderPlugin implements ProviderPlugin {
  meta: ProviderMeta = {
    id: "your-provider",
    name: "Your Provider",
    icon: "🔌",
    version: "1.0.0",
    description: "Your cloud provider integration",
    credentialSchema: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "sk-...",
      },
      {
        key: "region",
        label: "Region",
        type: "select",
        required: true,
        options: ["us-east", "eu-west", "ap-south"],
      },
    ],
    capabilities: ["storage", "compute"],
  };

  async validate(
    credentials: Record<string, string>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!credentials.api_key) errors.push("API key is required");
    if (credentials.api_key && credentials.api_key.length < 10) {
      errors.push("API key looks too short");
    }
    return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  async test(
    credentials: Record<string, string>
  ): Promise<HealthStatus> {
    try {
      const client = new YourProviderClient(credentials);
      const healthy = await client.ping();
      return {
        status: healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        latency: 0,
        details: healthy ? {} : { error: "Ping failed" },
      };
    } catch (err) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: { error: String(err) },
      };
    }
  }
}
```

### 3. Register Plugin

Add your plugin to `src/providers/index.ts`:

```typescript
import { YourProviderPlugin } from "./your-provider/plugin";

export const PROVIDERS: Record<string, ProviderPlugin> = {
  ...CloudflareProvider.register(),
  ...FirebaseProvider.register(),
  ...GitHubProvider.register(),
  "your-provider": new YourProviderPlugin(),
};
```

### 4. Run Validation

```bash
npm run typecheck
npm test
```

## Plugin Capabilities

Each provider declares its capabilities in `meta.capabilities`. The system uses these for:

- Displaying available actions in the UI
- Routing commands to the right handler
- Filtering provider features

### Current Capabilities

| Capability | Cloudflare | Firebase | GitHub |
|-----------|-----------|----------|--------|
| `dns` | ✅ | — | — |
| `workers` | ✅ | — | — |
| `r2` | ✅ | — | — |
| `d1` | ✅ | — | — |
| `kv` | ✅ | — | — |
| `pages` | ✅ | — | — |
| `firestore` | — | ✅ | — |
| `storage` | — | ✅ | — |
| `auth` | — | ✅ | — |
| `realtime` | — | ✅ | — |
| `repos` | — | — | ✅ |
| `orgs` | — | — | ✅ |
| `search` | — | — | ✅ |

## Testing

```typescript
import { describe, it, expect } from "vitest";
import { YourProviderPlugin } from "../plugin";

describe("YourProviderPlugin", () => {
  const plugin = new YourProviderPlugin();

  it("has correct metadata", () => {
    expect(plugin.meta.id).toBe("your-provider");
    expect(plugin.meta.capabilities).toContain("storage");
  });

  it("validates credentials", async () => {
    const result = await plugin.validate({ api_key: "valid-key-12345" });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid credentials", async () => {
    const result = await plugin.validate({ api_key: "short" });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
```

## Best Practices

1. **Fail fast** — validate credentials synchronously before making API calls
2. **Handle errors** — wrap all provider API calls in try/catch
3. **Rate limit yourself** — respect upstream API limits
4. **Log context** — include provider ID in all logs
5. **No secrets in logs** — sanitize credentials before logging
6. **Minimal dependencies** — prefer native fetch/Web Crypto over SDKs
