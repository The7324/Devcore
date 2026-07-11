# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial project setup with Hono, Drizzle ORM, Cloudflare Workers
- Telegram bot integration with command routing
- Auth layer with RBAC (Owner, Admin, ReadOnly)
- Session management with TTL expiry
- Rate limiting with token-bucket algorithm
- Audit logging for all actions
- Connection management with encrypted credential storage
- Cloudflare provider (DNS, Workers, R2, D1, KV, Pages)
- Firebase provider (Firestore, Storage, Auth)
- GitHub provider (Repositories, Orgs, Search)
- Provider plugin system with extensible architecture
- AES-256-GCM credential encryption
- Health monitoring for all provider connections
- Inline keyboard UI for Telegram
- Environment variable validation with Zod
- Structured logging with configurable levels

### Infrastructure
- CI/CD pipeline with GitHub Actions
- Cloudflare Workers deployment configuration
- Docker support
- Vitest test suite with coverage
- TypeScript strict mode configuration
- ESLint and Prettier configuration
- D1 database migrations
