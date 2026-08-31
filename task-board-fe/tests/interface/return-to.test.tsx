import { afterEach, describe, expect, test, vi } from 'vitest'
import { isBoardReturnTo } from '../../src/authentication/interface/react/returnTo'

describe('isBoardReturnTo', () => {
  afterEach(() => vi.unstubAllGlobals())

  test.each([
    '/board',
    '/board/task-101?view=compact#details',
    '/board/task%20with%20spaces',
    '/board/%2525',
    '/board/%',
    '/board/%2',
  ])('accepts a local board destination: %s', (returnTo) => {
    expect(isBoardReturnTo(returnTo)).toBe(true)
  })

  test.each([
    'https://attacker.example/board',
    '//attacker.example/board',
    'https://user:password@attacker.example/board',
    '/boardroom',
    '/board/%252e%252e/login',
    '/board%3Ftask',
    '/board%23task',
    '/board/task\u0001',
    '/board/%E0%A4%A',
    'http://[',
  ])('rejects an unsafe or non-board destination: %s', (returnTo) => {
    expect(isBoardReturnTo(returnTo)).toBe(false)
  })

  test('uses the fixed application origin while rendered without a browser', () => {
    vi.stubGlobal('window', undefined)

    expect(isBoardReturnTo('/board')).toBe(true)
    expect(isBoardReturnTo('https://task-board.invalid/board')).toBe(true)
    expect(isBoardReturnTo('https://attacker.example/board')).toBe(false)
  })

  test('does not treat the server fallback origin as local in a browser', () => {
    expect(isBoardReturnTo('https://task-board.invalid/board')).toBe(false)
  })
})
