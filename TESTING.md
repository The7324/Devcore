# Testing

## Overview

Tests use [Vitest](https://vitest.dev/) with `happy-dom` environment.

## Running Tests

```bash
npm test              # Run all tests
npm run typecheck     # TypeScript type checking
npm run coverage      # Run tests with coverage report
```

## Test Structure

```
src/
├── auth/__tests__/
├── commands/__tests__/
├── connections/__tests__/
├── providers/
│   ├── cloudflare/__tests__/
│   ├── firebase/__tests__/
│   └── github/__tests__/
├── telegram/__tests__/
└── utils/__tests__/
```

## Writing Tests

```typescript
import { describe, it, expect, vi } from "vitest";
import { YourModule } from "../module";

describe("YourModule", () => {
  it("should do something", () => {
    const result = YourModule.someFunction();
    expect(result).toBe(expectedValue);
  });

  it("should handle errors", () => {
    expect(() => YourModule.badInput(null)).toThrow("Invalid input");
  });
});
```

### Mocking

```typescript
// Mock a provider
vi.mock("../providers/cloudflare/client", () => ({
  CloudflareClient: vi.fn().mockImplementation(() => ({
    listZones: vi.fn().mockResolvedValue([{ name: "example.com" }]),
  })),
}));
```

### Testing Telegram Commands

```typescript
import { createMockContext } from "../test-utils";

it("handles /ping command", async () => {
  const ctx = createMockContext("/ping");
  await command.handle(ctx);
  expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining("pong")
  );
});
```

## Coverage

Coverage is collected using `@vitest/coverage-v8`. Report is written to `./coverage/`.

```bash
npm run coverage
open coverage/index.html
```

## Configuration

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/types.ts",
        "src/database/migrations/**",
      ],
    },
  },
});
```

## Best Practices

1. **Unit test business logic** — focus on providers, auth, validation
2. **Mock external APIs** — never hit real Cloudflare/Firebase/GitHub in tests
3. **Test error paths** — invalid credentials, network failures, permission denied
4. **Keep tests fast** — no real I/O, no network
5. **Test edge cases** — empty results, pagination, rate limits
