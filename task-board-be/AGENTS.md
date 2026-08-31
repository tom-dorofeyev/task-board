# Backend contributor guide

## Scope and stack

This directory contains the Task Board API and its MCP stdio adapter. It uses NestJS and TypeScript, with Vitest for unit and API end-to-end tests. Development uses in-memory storage; sessions, tasks, and idempotency records are intentionally ephemeral.

## Run locally

```sh
npm install
cp .env.example .env
npm run start:dev
```

The default API port is `3001`. In development and test environments the supplied users include `demo` and `blocked`; use the configured demo password (the example is `password`). Keep `TASK_BOARD_COOKIE_SECURE=false` only for local HTTP; use secure cookies in production HTTPS.

## Architecture rules

Organize features by their existing layers:

- `domain`: entities, value types, and rules independent of NestJS or storage.
- `application`: use cases, services, and dependency ports.
- `infrastructure`: adapters such as in-memory repositories, ID generators, and cursor codecs.
- `presentation`: Nest controllers, guards, decorators, and HTTP-specific response behavior.
- `shared`: cross-cutting application errors and HTTP error translation.

Dependencies must point inward: controllers depend on application services; application services depend on ports; infrastructure implements ports. Do not import NestJS, Express, environment variables, or concrete repositories into domain or application logic. Add a port before adding an external persistence, cryptography, or transport implementation.

## HTTP contract and security

- Keep task access behind the existing authentication and permission guards. Use `@Public()` only for intentionally unauthenticated routes.
- Preserve cookie-based sessions: the cookie name is `task_board_session`, tokens must not be logged, and secure-cookie defaults must remain safe for production.
- Validate all request input at the boundary/application entry point. Task drafts require the exact documented fields; do not silently accept unknown fields.
- Preserve create idempotency: a key is scoped to the authenticated user and cannot be reused for different task content.
- Preserve cursor integrity and bind continuation tokens to the authenticated user, requested status, and filter identity.
- Route expected application failures through `ApplicationError` and the shared HTTP exception filter; avoid leaking internals in responses.

## API behavior

Authentication is exposed through `/auth/login`, `/auth/session`, and `/auth/logout`. Task operations use `/tasks`, `/tasks/:taskId`, and `/tasks/:taskId/move`; task reads and writes have explicit permissions. Statuses are `todo`, `in-progress`, and `done`; priorities are `low`, `medium`, and `high`.

When changing a contract, update the backend unit/e2e tests, the frontend integration adapter and its tests, and the MCP client/tool schema if it exposes that behavior.

## MCP adapter

The adapter entry point is `src/mcp/main.ts`; build first, then run `npm run start:mcp`. It receives `TASK_BOARD_API_URL` and `TASK_BOARD_SESSION_COOKIE`. Never write the session cookie to output, logs, or persisted storage.

## Tests and checks

Run the narrowest relevant check first, then the appropriate broader suite:

```sh
npm run lint
npm run test
npm run test:e2e
npm run build
```

Use focused Vitest runs while iterating when practical. Add tests for authorization, input validation, idempotency, ordering, cursor behavior, and error mapping whenever those behaviors change.

## Before handing off

- Format via `npm run format` when needed and keep lint clean.
- Do not commit `.env`, built output, coverage, or secret-bearing MCP configuration.
- State which checks you ran and any checks intentionally not run.
