# Frontend contributor guide

## Scope and stack

This directory contains the Task Board browser app: React, TypeScript, Vite, React Router, Vitest, and Playwright. The app talks to `/auth` and `/tasks` through Vite’s same-origin development proxy, or through an opt-in mock backend.

## Run locally

```sh
npm install
npm run dev
```

For isolated UI development, use `npm run dev:mock`. To use the real API, start `../task-board-be` on port `3001` and set `TASK_BOARD_API_ORIGIN` in `.env` if a different origin is needed. Do not prefix this variable with `VITE_`.

## Architecture rules

The source is organized by feature and layer:

- `src/task-board/domain`: task types, task ordering, and client-side validation.
- `src/task-board/application`: use cases, state snapshots, page control, and ports.
- `src/task-board/infrastructure`: HTTP repositories and local seed data.
- `src/task-board/interface/react`: routes, providers, hooks, and view components.
- `src/authentication`: follows the same domain/application/infrastructure/interface split.
- `src/shared`: cross-feature HTTP and interface utilities.

Keep React, browser APIs, and HTTP details out of domain and application code. Define a port in `application/ports` before adding an external adapter. Keep application behavior in use cases or focused controllers/hooks; components should render state and dispatch explicit intents.

## UI and routing conventions

- Preserve route behavior: `/login`, `/board`, `/board/new-task`, and `/board/:taskId`.
- Use `TaskBoardRoute` and `AuthProvider` composition boundaries rather than constructing production services inside leaf components.
- Keep URL state and task-selection behavior deep-linkable.
- Reuse the task domain statuses and priorities instead of duplicating string unions.
- Maintain accessible controls, labels, keyboard behavior, focus management, and meaningful loading/error/empty states when changing the UI.

## HTTP and authentication

- Use the shared HTTP boundary/services; do not call `fetch` directly from React components or use cases.
- Session authentication depends on cookies. Preserve credentials behavior and the unauthorized-session invalidation flow.
- Keep the mock backend opt-in (`TASK_BOARD_USE_MOCK_API=true`) and behaviorally aligned with the real API.
- Treat server responses as untrusted at the infrastructure boundary; map them into domain/application types there.

## Tests and checks

Run the narrowest relevant check first, then the appropriate broader suite:

```sh
npm run lint
npm run test:unit
npm run test:e2e
npm run test:e2e:integration
npm run build
```

Install Chromium once for Playwright with `npx playwright install chromium`. Keep tests behavior-focused: unit tests cover domain/application code, interface tests cover React boundaries, and Playwright tests cover browser flows. Update mock and real-API coverage when changing a shared contract.

## Before handing off

- Format via `npm run format` when needed and keep lint clean.
- Avoid generated output, `.env` files, coverage, and Playwright artifacts in commits.
- State which checks you ran and any checks intentionally not run.
