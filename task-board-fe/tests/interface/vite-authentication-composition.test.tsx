import { expect, test } from 'vitest'
import viteConfig from '../../vite.config'

test('composes the mock authentication backend only when explicitly enabled', () => {
  const configuration = viteConfig({
    command: 'serve',
    mode: 'test',
    isSsrBuild: false,
    isPreview: false,
  })
  const plugins = Array.isArray(configuration.plugins)
    ? configuration.plugins
    : [configuration.plugins]

  expect(plugins).not.toContainEqual(
    expect.objectContaining({ name: 'mock-authentication-backend' }),
  )
  expect(configuration.server?.proxy).toMatchObject({
    '/auth': 'http://127.0.0.1:3001',
    '/tasks': 'http://127.0.0.1:3001',
  })
})
