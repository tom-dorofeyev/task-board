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

The frontend proxies `/auth` and `/tasks` to `http://127.0.0.1:3001`, so browser requests remain same-origin. Without `TASK_BOARD_MONGODB_URI`, the API uses in-memory task storage and tasks reset whenever it restarts. Sessions always reset on API restart.

## Run with Docker Compose

Prerequisite: Docker Compose v2.

From the repository root, build and start the local application:

```sh
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) for the web UI. The API is available at `http://localhost:3001`. The Compose setup uses the demo account `demo` and the password `password` unless you set `TASK_BOARD_DEMO_PASSWORD` before starting it:

```sh
TASK_BOARD_DEMO_PASSWORD='choose-a-local-demo-password' docker compose up --build
```

The web container proxies `/auth` and `/tasks` to the API, so browser sessions remain same-origin HTTP-only cookies. The internal MongoDB service stores tasks, task keys, and idempotency records in its `task-board-mongo-data` named volume. It survives API restarts, container replacement, `docker compose down`, and a later `docker compose up`. API sessions and cookies remain in memory and reset when the API restarts. Run `docker compose down --volumes` only when you intentionally want to delete saved tasks.

### Use the MCP stdio adapter

The MCP service is a local stdio process, not a public network endpoint. It has no mapped port and only reaches the API on the Compose network. First start the API and obtain a session cookie without placing it in a project file:

```sh
curl --fail --silent --show-error \
  --cookie-jar /tmp/task-board-cookie.txt \
  --header 'Content-Type: application/json' \
  --data '{"username":"demo","password":"password"}' \
  http://localhost:3001/auth/login
export TASK_BOARD_SESSION_COOKIE="$(awk '$6 == "task_board_session" { print $6 "=" $7 }' /tmp/task-board-cookie.txt)"
rm /tmp/task-board-cookie.txt
```

If you supplied `TASK_BOARD_DEMO_PASSWORD`, replace `password` in that request with the same value. Keep `TASK_BOARD_SESSION_COOKIE` in your local agent’s environment; do not commit it, put it in a Compose file, or paste it into an agent configuration checked into source control.

Configure a local stdio MCP server to execute this command from the repository root, with `TASK_BOARD_SESSION_COOKIE` forwarded from its environment:

```sh
docker compose run --rm -T mcp
```

For example, an agent configuration that supports command arguments and environment variables can use:

```json
{
  "command": "docker",
  "args": ["compose", "run", "--rm", "-T", "mcp"],
  "env": {
    "TASK_BOARD_SESSION_COOKIE": "${TASK_BOARD_SESSION_COOKIE}"
  }
}
```

The exact variable-substitution syntax is agent-specific. Ensure its process receives the current `TASK_BOARD_SESSION_COOKIE`; creating a new browser/API session or restarting the API invalidates prior session access.

## Configuration

Both applications include an `.env.example` with local-development defaults.

| Application | Variable | Default | Purpose |
| --- | --- | --- | --- |
| Backend | `PORT` | `3001` | HTTP API port |
| Backend | `TASK_BOARD_COOKIE_SECURE` | `false` | Set `true` for HTTPS deployments |
| Backend | `TASK_BOARD_DEMO_PASSWORD` | `password` | Demo-user password; explicitly configure for production |
| Backend | `TASK_BOARD_MONGODB_URI` | unset | MongoDB connection URI for task persistence |
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
