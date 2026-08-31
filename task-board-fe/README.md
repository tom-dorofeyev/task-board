# Task Board frontend

The development server proxies `/auth` and `/tasks` to the Nest API, keeping
browser requests same-origin. Copy `.env.example` to `.env` (or export its
variables) and start both applications:

```sh
# task-board-be
PORT=3001 TASK_BOARD_COOKIE_SECURE=false TASK_BOARD_DEMO_PASSWORD=password npm run start:dev

# task-board-fe
TASK_BOARD_API_ORIGIN=http://127.0.0.1:3001 npm run dev
```

`TASK_BOARD_API_ORIGIN` is Vite-server-only and must not use the `VITE_`
prefix. For isolated frontend work, use `npm run dev:mock` to opt into the
mock HTTP backend.

Run the cross-application browser test with:

```sh
npm run test:e2e:integration
```

It starts both services on dedicated ports and verifies login, task creation,
and persistence after reload.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## End-to-end tests

Install the Chromium browser once after installing dependencies:

```sh
npx playwright install chromium
```

Run the Playwright tests with:

```sh
npm run test:e2e
```

Playwright starts the Vite development server automatically.

### Testing conventions

Keep acceptance behavior in executable tests. Do not add Gherkin `.feature`
files unless the repository also adopts and runs a Gherkin test runner.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
