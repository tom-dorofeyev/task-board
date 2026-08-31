import { expect, test } from '@playwright/test'

const REJECTED_LOGIN_RETURN_DESTINATIONS = [
  ['an invalid destination', '/login?returnTo=%2Fboard%2F%252e%252e%2Flogin'],
  ['an external destination', '/login?returnTo=https://attacker.example/board'],
  ['the login page', '/login?returnTo=%2Flogin'],
]

test('anonymous board deep links redirect to login with an exact return destination', async ({
  page,
}) => {
  await page.goto('/board/task-101?view=compact#details')

  await expect(page).toHaveURL(
    '/login?returnTo=%2Fboard%2Ftask-101%3Fview%3Dcompact%23details',
  )
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
})

test('authenticated login navigation rejects an external return destination', async ({
  page,
}) => {
  await authenticate(page)

  await page.goto('/login?returnTo=https://attacker.example/board')

  await expect(page).toHaveURL('/board')
})

test('anonymous login navigation removes an external return destination', async ({
  page,
}) => {
  await page.goto('/login?returnTo=https://attacker.example/board')

  await expect(page).toHaveURL('/login')
})

test('anonymous login navigation removes an encoded traversal destination', async ({
  page,
}) => {
  await page.goto('/login?returnTo=%2Fboard%2F%252e%252e%2Flogin')

  await expect(page).toHaveURL('/login')
})

test('unknown paths render an accessible not-found page', async ({ page }) => {
  await page.goto('/unknown-path')

  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
})

test('valid login restores the requested board destination', async ({
  page,
}) => {
  await page.goto('/login?returnTo=%2Fboard%2Fnew-task')

  await login(page)

  await expect(page).toHaveURL('/board/new-task')
})

test('valid login without a return destination opens the board', async ({
  page,
}) => {
  await page.goto('/login')

  await login(page)

  await expect(page).toHaveURL('/board')
})

for (const [destinationName, url] of REJECTED_LOGIN_RETURN_DESTINATIONS) {
  test(`successful credential login with ${destinationName} opens the board`, async ({
    page,
  }) => {
    await page.goto(url)

    await login(page)

    await expect(page).toHaveURL('/board')
  })
}

test('invalid login remains on login with accessible feedback', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill('demo')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('alert')).toContainText('We could not log you in')
})

test('successful logout opens login', async ({ page }) => {
  await authenticate(page)
  await page.goto('/board')

  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page).toHaveURL('/login')
})

test('failed logout retains board access with accessible feedback', async ({
  page,
}) => {
  await authenticate(page)
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 500 }))
  await page.goto('/board')

  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page).toHaveURL('/board')
  await expect(
    page.getByRole('heading', { name: 'Product roadmap' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(
    'We could not log you out',
  )
})

test('task-fetch unauthorized redirects to login with the current board URL', async ({
  page,
}) => {
  await authenticate(page)
  await page.route('**/tasks*', (route) => route.fulfill({ status: 401 }))

  await page.goto('/board/task-101?view=compact#details')

  await expect(page).toHaveURL(
    '/login?returnTo=%2Fboard%2Ftask-101%3Fview%3Dcompact%23details',
  )
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
})

test('task-fetch forbidden retains the session and shows generic feedback', async ({
  page,
}) => {
  await authenticate(page)
  await page.route('**/tasks*', (route) => route.fulfill({ status: 403 }))

  await page.goto('/board')

  await expect(page).toHaveURL('/board')
  await expect(page.getByRole('alert')).toContainText('Board unavailable')
  await page.goto('/login')
  await expect(page).toHaveURL('/board')
})

async function authenticate(page: import('@playwright/test').Page) {
  const response = await page.context().request.post('/auth/login', {
    data: { username: 'demo', password: 'demo-password' },
  })

  expect(response.ok()).toBe(true)
}

async function login(page: import('@playwright/test').Page) {
  await page.getByRole('textbox', { name: 'Username' }).fill('demo')
  await page.getByLabel('Password').fill('demo-password')
  await page.getByRole('button', { name: 'Log in' }).click()
}
