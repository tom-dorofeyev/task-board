import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FetchHttpClient } from '../../src/shared/infrastructure/http/FetchHttpClient'

describe('FetchHttpClient', () => {
  it('forwards a body as JSON with cookie credentials and returns JSON response data', async () => {
    const { response, request } = await executeRequest(
      new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { 'x-request-id': 'request-1' },
      }),
      {
        method: 'POST',
        path: '/tasks',
        credentials: 'include',
        headers: { 'x-client': 'task-board' },
        body: { title: 'New task' },
      },
    )

    assert.deepEqual(request, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-client': 'task-board',
      },
      body: JSON.stringify({ title: 'New task' }),
    })
    assert.deepEqual(response, {
      status: 201,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'x-request-id': 'request-1',
      },
      body: { created: true },
    })
  })

  it('does not serialize a request without a body', async () => {
    const { request } = await executeRequest(
      new Response(null, { status: 204 }),
      {
        method: 'GET',
        path: '/tasks',
        headers: { accept: 'application/json' },
      },
    )

    assert.deepEqual(request, {
      method: 'GET',
      credentials: undefined,
      headers: { accept: 'application/json' },
      body: undefined,
    })
  })

  it('returns the status for an empty unauthorized response', async () => {
    const response = await executeResponse(new Response(null, { status: 401 }))

    assert.equal(response.status, 401)
    assert.equal(response.body, undefined)
  })

  it('returns the status for a non-JSON unauthorized response', async () => {
    const response = await executeResponse(
      new Response('Unauthorized', { status: 401 }),
    )

    assert.equal(response.status, 401)
    assert.equal(response.body, undefined)
  })

  it('returns the status for an empty forbidden response', async () => {
    const response = await executeResponse(new Response(null, { status: 403 }))

    assert.equal(response.status, 403)
    assert.equal(response.body, undefined)
  })

  it('returns the status for a non-JSON forbidden response', async () => {
    const response = await executeResponse(
      new Response('Forbidden', { status: 403 }),
    )

    assert.equal(response.status, 403)
    assert.equal(response.body, undefined)
  })

  it('rejects malformed bodies for responses other than unauthorized or forbidden', async () => {
    await assert.rejects(() =>
      executeResponse(new Response('Unavailable', { status: 503 })),
    )
  })
})

async function executeResponse(response: Response) {
  const fetch = globalThis.fetch
  globalThis.fetch = async () => response

  try {
    return await new FetchHttpClient().execute({
      method: 'GET',
      path: '/tasks',
    })
  } finally {
    globalThis.fetch = fetch
  }
}

async function executeRequest(
  response: Response,
  request: Parameters<FetchHttpClient['execute']>[0],
) {
  const fetch = globalThis.fetch
  let actualRequest: RequestInit | undefined
  globalThis.fetch = async (_path, options) => {
    actualRequest = options
    return response
  }

  try {
    const actualResponse = await new FetchHttpClient().execute(request)
    return { response: actualResponse, request: actualRequest }
  } finally {
    globalThis.fetch = fetch
  }
}
