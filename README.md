# Task Board

A full-stack task board for creating, organizing, and moving work through **To do**, **In progress**, and **Done**. The repository contains a React single-page application and a NestJS API, designed to run together locally or independently during development.

## What it does

- Authenticates users with an HTTP-only session cookie.
- Displays tasks in status columns with deep links for task details and creation.
- Creates, edits, and reorders tasks, including moves between columns.
- Validates task input on both the client and the server.
- Supports cursor-based task pagination and idempotent task creation.
- Provides an opt-in mock API for isolated frontend work.
- Exposes the backend through an optional MCP stdio adapter.

## Repository layout

| Directory | Purpose | Stack |
| --- | --- | --- |
| [`task-board-fe`](./task-board-fe) | Browser application | React, TypeScript, Vite, React Router, Vitest, Playwright |
| [`task-board-be`](./task-board-be) | HTTP API and MCP adapter | NestJS, TypeScript, Vitest |

Each application has its own dependencies, environment file, and commands. See its local `AGENTS.md` for development guidance.

## Quick start

Prerequisites: Node.js 20+ and npm.

Install dependencies in both applications:

```sh
cd task-board-be && npm install
cd ../task-board-fe && npm install
```

Start the API in one terminal:

```sh
cd task-board-be
cp .env.example .env
npm run start:dev
```

Start the frontend in another terminal:

```sh
cd task-board-fe
cp .env.example .env
npm run dev
```

Open the local Vite URL shown in the terminal. The sample configuration uses the `demo` user with password `password`.

The frontend proxies `/auth` and `/tasks` to `http://127.0.0.1:3001`, so browser requests remain same-origin. The API’s in-memory users, sessions, tasks, and idempotency records reset whenever it restarts.

## Configuration

Both applications include an `.env.example` with local-development defaults.

| Application | Variable | Default | Purpose |
| --- | --- | --- | --- |
| Backend | `PORT` | `3001` | HTTP API port |
| Backend | `TASK_BOARD_COOKIE_SECURE` | `false` | Set `true` for HTTPS deployments |
| Backend | `TASK_BOARD_DEMO_PASSWORD` | `password` | Demo-user password; explicitly configure for production |
| Frontend | `TASK_BOARD_API_ORIGIN` | `http://127.0.0.1:3001` | API origin used by Vite’s development proxy |

`TASK_BOARD_API_ORIGIN` is intentionally not prefixed with `VITE_`: it is read only by the Vite dev-server configuration and is not exposed to browser code.

For frontend-only work, run `npm run dev:mock` inside `task-board-fe`. This enables the local mock HTTP backend instead of proxying to the API.

## Common commands

Run commands from the relevant application directory.

| Goal | Frontend | Backend |
| --- | --- | --- |
| Start in development | `npm run dev` | `npm run start:dev` |
| Production build | `npm run build` | `npm run build` |
| Lint | `npm run lint` | `npm run lint` |
| Unit tests | `npm run test:unit` | `npm run test` |
| End-to-end tests | `npm run test:e2e` | `npm run test:e2e` |
| Cross-app browser test | `npm run test:e2e:integration` | — |

Install the Playwright Chromium browser once before frontend browser tests:

```sh
cd task-board-fe
npx playwright install chromium
```

## API overview

Authenticated API endpoints are served by the backend:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/login` | Starts a session and sets the cookie |
| `GET` | `/auth/session` | Returns the current user |
| `POST` | `/auth/logout` | Ends the current session |
| `GET` | `/tasks?status=…` | Lists one status column, with cursor pagination |
| `POST` | `/tasks` | Creates a task using an idempotency key |
| `GET` | `/tasks/:taskId` | Retrieves a task |
| `PUT` | `/tasks/:taskId` | Replaces a task draft |
| `POST` | `/tasks/:taskId/move` | Moves a task to a status and position |

Task statuses are `todo`, `in-progress`, and `done`; priorities are `low`, `medium`, and `high`.

## MCP adapter

After building the backend, start the stdio adapter with a reachable API and an authenticated session cookie:

```sh
cd task-board-be
npm run build
TASK_BOARD_API_URL=https://task-board.example \
TASK_BOARD_SESSION_COOKIE='task_board_session=…' \
npm run start:mcp
```

It offers tools for the current user and for listing, reading, creating, updating, and moving tasks. The provided session cookie is held only in process memory.

## Architecture

Both applications organize task-board behavior in layers. Domain code owns task rules and types; application code expresses use cases and ports; infrastructure code implements browser/HTTP or in-memory adapters; and presentation/interface code handles Nest controllers or React views. Keep dependencies flowing inward when extending the project.

## Further guidance

- [Frontend contributor notes](./task-board-fe/AGENTS.md)
- [Backend contributor notes](./task-board-be/AGENTS.md)
