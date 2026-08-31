import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createMockAuthenticationBackendPlugin } from './src/authentication/infrastructure/mock/createMockAuthenticationBackendPlugin.js'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const useMockApi = environment.TASK_BOARD_USE_MOCK_API === 'true'
  const apiOrigin = environment.TASK_BOARD_API_ORIGIN ?? 'http://127.0.0.1:3001'

  return {
    plugins: [
      react(),
      ...(useMockApi ? [createMockAuthenticationBackendPlugin()] : []),
    ],
    server: useMockApi
      ? undefined
      : {
          proxy: {
            '/auth': apiOrigin,
            '/tasks': apiOrigin,
          },
        },
  }
})
