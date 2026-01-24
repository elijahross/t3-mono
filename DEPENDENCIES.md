# Template Dependencies

This file tracks the versions of dependencies scaffolded by t3-mono.
Update these periodically to keep generated projects current.

## Core Stack

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| next | ^15.1.0 | [npm](https://www.npmjs.com/package/next) | `npm view next version` |
| react | ^19.0.0 | [npm](https://www.npmjs.com/package/react) | `npm view react version` |
| typescript | ^5.7.2 | [npm](https://www.npmjs.com/package/typescript) | `npm view typescript version` |
| tailwindcss | ^4.0.0 | [npm](https://www.npmjs.com/package/tailwindcss) | `npm view tailwindcss version` |

## Database & Auth

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| @prisma/client | ^6.1.0 | [npm](https://www.npmjs.com/package/@prisma/client) | `npm view @prisma/client version` |
| better-auth | ^1.1.10 | [npm](https://www.npmjs.com/package/better-auth) | `npm view better-auth version` |

## tRPC

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| @trpc/server | ^11.0.0-rc.682 | [npm](https://www.npmjs.com/package/@trpc/server) | `npm view @trpc/server version` |
| @trpc/client | ^11.0.0-rc.682 | [npm](https://www.npmjs.com/package/@trpc/client) | `npm view @trpc/client version` |
| @tanstack/react-query | ^5.62.8 | [npm](https://www.npmjs.com/package/@tanstack/react-query) | `npm view @tanstack/react-query version` |

## AI Extension

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| @langchain/core | ^0.3.28 | [npm](https://www.npmjs.com/package/@langchain/core) | `npm view @langchain/core version` |
| @langchain/anthropic | ^0.3.11 | [npm](https://www.npmjs.com/package/@langchain/anthropic) | `npm view @langchain/anthropic version` |
| @langchain/openai | ^0.3.18 | [npm](https://www.npmjs.com/package/@langchain/openai) | `npm view @langchain/openai version` |
| langchain | ^0.3.7 | [npm](https://www.npmjs.com/package/langchain) | `npm view langchain version` |

## UI Extension

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| lucide-react | ^0.562.0 | [npm](https://www.npmjs.com/package/lucide-react) | `npm view lucide-react version` |
| recharts | ^2.15.4 | [npm](https://www.npmjs.com/package/recharts) | `npm view recharts version` |
| sonner | ^2.0.7 | [npm](https://www.npmjs.com/package/sonner) | `npm view sonner version` |

## Restate Extension

| Package | Current | Latest | Check |
|---------|---------|--------|-------|
| @restatedev/restate-sdk | ^1.9.1 | [npm](https://www.npmjs.com/package/@restatedev/restate-sdk) | `npm view @restatedev/restate-sdk version` |
| @aws-sdk/client-s3 | ^3.712.0 | [npm](https://www.npmjs.com/package/@aws-sdk/client-s3) | `npm view @aws-sdk/client-s3 version` |

---

## Quick Check Script

Run this to check all versions at once:

```bash
echo "=== Core ===" && \
npm view next version && \
npm view react version && \
npm view typescript version && \
npm view tailwindcss version && \
echo "=== Database ===" && \
npm view @prisma/client version && \
npm view better-auth version && \
echo "=== tRPC ===" && \
npm view @trpc/server version && \
npm view @tanstack/react-query version && \
echo "=== AI ===" && \
npm view @langchain/core version && \
npm view langchain version && \
echo "=== Restate ===" && \
npm view @restatedev/restate-sdk version
```

## Files to Update

When updating versions, modify these files:

1. `src/scaffolding/t3.rs` - Core dependencies in `finalize_package_json()`
2. `src/commands/add.rs` - AI and UI dependencies
3. `templates/restate/services/package.json` - Restate dependencies

## Update Cadence

- **Monthly**: Check for minor/patch updates
- **Quarterly**: Check for major version updates (may require template changes)
- **On Release**: Always check before publishing new t3-mono version
