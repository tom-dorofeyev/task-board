# Authentication Layer Plan

## Status

- Product specification: approved
- Architecture and delivery slices: approved

## Scope

Introduce cookie-session authentication architecture and working mock-server support for the task-board SPA. The design must be usable with a future httpOnly JWT-cookie backend without client token persistence or authorization-header management.

## Approved Product Specification

### User behavior

- An `AuthProvider` React context owns and exposes current user and session state.
- On application startup, the provider requests `GET /auth/session` before protected content renders.
- While session state is resolving, the application shows authentication loading UI and does not mount or show the board.
- Every `/board` route is protected. An anonymous visitor is redirected to `/login` with a `returnTo` query parameter representing the originally requested internal board URL.
- Login presents username and password fields and authenticates through the mock backend. On success, it returns to a valid `returnTo`; otherwise it navigates to `/board`.
- An authenticated visitor who opens `/login` is redirected to `/board`.
- Logout requests server-side logout first. Only a successful response clears React authentication state and navigates to login. A failed logout preserves the signed-in state and shows a generic error.
- Any backend request that returns HTTP 401 after session resolution clears session state and redirects to login, retaining the current board URL in `returnTo`.
- HTTP 403 is authorization failure, not authentication failure. It does not clear session or redirect; the initiating UI shows a generic error.
- The mock backend follows the intended server request/session behavior closely enough to exercise all flows.

### Acceptance Criteria

```gherkin
Feature: Authentication-protected task board

Scenario: Auth is checked before board content is visible
  Given a visitor opens a board URL
  When authentication status is loading
  Then an authentication loading state is shown
  And protected board content is not shown

Scenario: Unauthenticated board access
  Given a visitor has no active session
  When they open any board URL
  Then they are redirected to login
  And the requested URL is retained for post-login navigation

Scenario: Successful login
  Given an unauthenticated visitor is on login
  When valid username and password are submitted
  Then the visitor becomes authenticated
  And is redirected to the retained destination or /board when none exists

Scenario: Expired session during a backend request
  Given an authenticated visitor is viewing the board
  When a backend request returns 401
  Then auth state is cleared
  And the visitor is redirected to login
  And the current URL is retained

Scenario: Authorization failure
  Given an authenticated visitor makes a request
  When it returns 403
  Then the visitor remains authenticated
  And is not redirected to login
  And generic error feedback is shown

Scenario: Logout
  Given an authenticated visitor
  When the server confirms logout
  Then React auth state is cleared
  And login is shown

Scenario: Logout failure
  Given an authenticated visitor
  When the logout request fails
  Then the visitor remains authenticated
  And generic error feedback is shown
```

## Architecture

### Components and responsibilities

| Component                           | Responsibility                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AuthProvider and auth context       | Resolve and retain the current session, expose user/session state and session actions to React.                                                        |
| Route access-control adapters       | Gate protected board routes, render the auth-loading state, handle public-login access, and validate/restore `returnTo`.                               |
| Authentication application policies | Coordinate session check, login, logout, and client session invalidation independently of React and HTTP.                                              |
| Shared request boundary             | Execute cookie-participating requests; translate 401 into a transport-neutral unauthorized signal and 403 into a caller-visible authorization failure. |
| Authentication gateway              | Hide the `/auth/session`, login, and logout HTTP details from application policies.                                                                    |
| Task HTTP repository adapter        | Implements existing task ports over the shared request boundary, replacing direct local-storage composition as the authenticated source.               |
| Mock backend                        | Provides server-shaped session and task responses, including cookie-session semantics and controlled 401/403 outcomes for tests.                       |

### Dependency and control flow

`React routes/views -> application policies -> domain concepts`

`React AuthProvider -> application policies`

`HTTP auth/task adapters -> application ports`

`HTTP request boundary -> unauthorized-session notification`

`Mock backend now / real backend later -> HTTP adapters`

- App startup: `AuthProvider` requests session state and publishes resolving, authenticated, or anonymous state.
- Anonymous protected navigation: route access control redirects to login and preserves the requested internal destination.
- Successful login: session policy establishes the user and navigation restores a validated destination or `/board`.
- Runtime 401: request boundary reports unauthorized; the session policy invalidates state once and route/navigation adapter redirects to login.
- Runtime 403: request boundary returns an authorization failure only; the caller renders generic feedback.
- Logout: the backend must confirm success before client state is invalidated.

### Boundary rules and contracts

- Task-board code must not know credentials, cookies, login routes, HTTP statuses, or tokens.
- Application policies must not know React Router, visual components, payload shapes, or mock-server details.
- HTTP adapters contain status codes, payloads, and cookie mechanics.
- `returnTo` may name only an internal `/board` destination. External URLs, login URLs, and invalid values fall back to `/board`.
- Preserve valid destinations exactly, including path, query string, and fragment.
- A 401 from the initial session check resolves to anonymous state; any later request 401 invokes global unauthorized-session handling.
- Concurrent/repeated 401 responses cause only one state invalidation and one redirect.
- A 403 never clears session or redirects.
- Do not persist tokens in local/session storage and do not construct `Authorization` headers. Browser cookie participation is configured at the request boundary.

### Trade-offs

- **Shared request boundary:** centralizes correct 401 handling and makes the real-server transition straightforward, at the cost of adding an explicit backend abstraction where none exists today.
- **AuthProvider as React adapter:** keeps session policy framework-independent while still offering idiomatic React consumption; routing/navigation is supplied through a narrow outer adapter.
- **Mock HTTP task adapter rather than local-storage fallback:** exercises authentication accurately and avoids ambiguous protected-data behavior, but migrates the current local demo persistence sooner.

### Compatibility and migration

- Preserve existing task application ports and replace the direct `LocalStorageTaskRepository` composition with a mock HTTP-backed implementation.
- Do not retain local-storage persistence as an implicit authenticated fallback. Its future role, if any, must be explicit demo/offline behavior.
- The mock route contract is the migration seam for the later cookie-backed server. Cross-origin deployment details (credentials and CORS) are isolated to the request boundary when applicable.

## Ordered, Committable Delivery Slices

### Slice 1 — Authentication contracts and mock backend semantics

- **Outcome:** Session, credentials, logout, unauthorized, and forbidden outcomes have clear application contracts; mock endpoints support session check, login, logout, and task access.
- **Criteria covered:** mock flow support and all foundational session semantics.
- **Dependencies/compatibility:** preserves existing task application ports; no UI changes required yet.
- **Why independently committable:** establishes and tests server-shaped contracts without changing user navigation or production UI behavior.
- **Proof:** unit tests for gateway translation and mock endpoint success, invalid-credential, 401, and 403 behavior.

### Slice 2 — Shared request boundary and unauthorized-session coordination

- **Outcome:** Cookie-oriented request execution consistently translates 401 and 403; a single unauthorized signal invalidates session once.
- **Criteria covered:** 401 redirect trigger infrastructure and 403 non-sign-out behavior.
- **Dependencies/compatibility:** depends on Slice 1 contracts; does not directly navigate from infrastructure.
- **Why independently committable:** creates a reusable policy seam before routes or task adapters consume it.
- **Proof:** integration tests show auth and task requests produce the same unauthorized result; 403 remains caller-visible.

### Slice 3 — AuthProvider and route access control

- **Outcome:** Auth loading state, `GET /auth/session` resolution, protected `/board` access, public login behavior, and safe `returnTo` handling are live.
- **Criteria covered:** loading gate, anonymous redirect, authenticated protected access, authenticated `/login` redirect.
- **Dependencies/compatibility:** depends on Slices 1–2; gate resolves before `TaskBoardProvider` mounts.
- **Why independently committable:** delivers safe access control end-to-end even before credential UI and authenticated task fetching are connected.
- **Proof:** React integration and Playwright tests cover board deep links, loading, anonymous redirect, return destination validation, and authenticated `/login` navigation.

### Slice 4 — Login and logout user flows

- **Outcome:** Username/password login, destination restoration, fallback navigation, successful logout, and failed-logout retention are available.
- **Criteria covered:** login success/failure and logout success/failure scenarios.
- **Dependencies/compatibility:** depends on Slices 1–3; no token handling is introduced.
- **Why independently committable:** completes all explicit authentication user actions through the mock backend.
- **Proof:** browser tests cover valid/invalid login, `returnTo` and fallback destinations, successful logout, and failed logout retaining board access.

### Slice 5 — Task repository migration to request adapter

- **Outcome:** Task fetches use the shared mock HTTP request boundary rather than direct local storage; expiry during task access is observable.
- **Criteria covered:** task-request 401 redirect and task-request 403 generic feedback.
- **Dependencies/compatibility:** depends on Slices 1–4; preserves task use-case interfaces while replacing its composed infrastructure adapter.
- **Why independently committable:** makes the primary protected data path work end-to-end and is directly swappable for the real backend.
- **Proof:** browser tests force task-fetch 401 and verify login redirect with preserved URL; force 403 and verify generic feedback without session loss.

## Test Strategy

- Unit: session transitions, successful/failed logout, safe return-destination validation, 401 de-duplication, and 403 non-sign-out behavior.
- React integration: provider resolution, protected/public routes, and generic failure presentation using the mock backend.
- Browser: protected deep-link restoration, authenticated login-page redirect, login fallback, session expiry during task fetching, 403 behavior, and failed logout.
