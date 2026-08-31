import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        html: '<!doctype html><html><body><div id="root"></div></body></html>',
      },
    },
    include: ['tests/interface/**/*.test.tsx'],
    setupFiles: ['./tests/interface/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/App.tsx',
        'src/main.tsx',
        'src/task-board/interface/react/TaskBoardPage.tsx',
        'src/task-board/interface/react/components/TaskBoardView.tsx',
        'src/task-board/interface/react/components/TaskCard.tsx',
      ],
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      thresholds: {
        statements: 62.39,
        branches: 63.15,
        functions: 69.44,
        lines: 61.11,
      },
    },
  },
})
