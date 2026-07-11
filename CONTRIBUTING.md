# Contributing

We welcome contributions! This document outlines the process.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/devcore.git`
3. Create a branch: `git checkout -b feature/your-feature`
4. Install dependencies: `npm install`
5. Make your changes
6. Run tests: `npm test`
7. Type check: `npm run typecheck`
8. Commit and push
9. Open a Pull Request

## Development Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Code Style

- **Language:** TypeScript (strict mode)
- **Formatting:** Prettier (single quotes, trailing commas)
- **Linting:** ESLint with TypeScript rules
- **Testing:** Vitest
- **Naming:** camelCase for functions/variables, PascalCase for classes/types

## Testing

```bash
npm test           # Run tests
npm run coverage   # Run with coverage
```

Tests use Vitest with `happy-dom` environment. Provider tests use mocks.

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Ensure type checking passes
5. Get at least one review
6. Squash commits before merging

## Provider Plugin Guidelines

To add a new provider:

1. Create `src/providers/<name>/` directory
2. Implement `ProviderPlugin` interface
3. Export from `src/providers/<name>/plugin.ts`
4. Add to `src/providers/index.ts`
5. Add tests in `src/providers/<name>/__tests__/`
6. Document in `PLUGINS.md`

See [PLUGINS.md](PLUGINS.md) for the full plugin development guide.

## Security Reports

**Do not** open public issues for security vulnerabilities. Instead, email the maintainers directly or follow the responsible disclosure process outlined in [SECURITY.md](SECURITY.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
