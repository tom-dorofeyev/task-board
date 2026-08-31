import { defineConfig, devices } from '@playwright/test'

const API_ORIGIN = 'http://127.0.0.1:3001'
const FRONTEND_ORIGIN = 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: FRONTEND_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../task-board-be run start',
      url: `${API_ORIGIN}/auth/session`,
      reuseExistingServer: false,
      env: {
        PORT: '3001',
        TASK_BOARD_COOKIE_SECURE: 'false',
        TASK_BOARD_DEMO_PASSWORD: 'password',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: FRONTEND_ORIGIN,
      reuseExistingServer: false,
      env: {
        TASK_BOARD_API_ORIGIN: API_ORIGIN,
        TASK_BOARD_USE_MOCK_API: 'false',
      },
    },
  ],
})
