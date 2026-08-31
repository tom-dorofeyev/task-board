import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { createSeedTasks } from '../../src/task-board/infrastructure/persistence/seedTasks'

const DEMO_USER = {
  id: 'demo-user',
  username: 'demo',
  displayName: 'Demo User',
}

beforeEach(() => {
  let tasks = createSeedTasks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname === '/tasks') {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            idempotencyKey: string
            task: (typeof tasks)[number]
          }
          const task = {
            ...body.task,
            id: `task-${tasks.length + 101}`,
            key: `NEX-${tasks.length + 101}`,
            position: tasks.filter((item) => item.status === body.task.status)
              .length,
          }
          tasks = [...tasks, task]
          return jsonResponse(task)
        }
        const status = url.searchParams.get('status')
        const items = tasks.filter((task) => task.status === status)
        return jsonResponse({ items, totalCount: items.length, pageInfo: {} })
      }
      const taskMatch = /^\/tasks\/([^/]+)$/.exec(url.pathname)
      if (taskMatch !== null) {
        const id = decodeURIComponent(taskMatch[1])
        const task = tasks.find((item) => item.id === id)
        if (task === undefined) return new Response(null, { status: 404 })
        if (init?.method === 'PUT') {
          const changes = JSON.parse(String(init.body))
          const updated = { ...task, ...changes }
          tasks = tasks.map((item) => (item.id === id ? updated : item))
          return jsonResponse(updated)
        }
        return jsonResponse(task)
      }
      return jsonResponse({ user: DEMO_USER })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}
