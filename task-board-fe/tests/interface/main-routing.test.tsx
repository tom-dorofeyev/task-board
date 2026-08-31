import { act } from 'react'
import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

test('browser entry point renders the board route', async () => {
  await act(async () => {
    await import('../../src/main')
  })

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Product roadmap' }),
  ).toBeInTheDocument()
})
