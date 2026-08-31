import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const response = await page.context().request.post('/auth/login', {
    data: { username: 'demo', password: 'demo-password' },
  })
  expect(response.ok()).toBe(true)
})

test('authenticated visitors load the server task board', async ({ page }) => {
  await page.goto('/board')

  await expect(
    page.getByRole('heading', { name: 'Product roadmap' }),
  ).toBeVisible()
  await expect(page.getByText('NEX-101')).toBeVisible()
})

test('task updates persist through the mock HTTP backend', async ({ page }) => {
  const updatedTitle = 'Map a better onboarding journey'
  await page.goto('/board')
  await page.getByRole('button', { name: /Open NEX-101/ }).click()
  await page.getByLabel('Title').fill(updatedTitle)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()

  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
})

test('task creation persists through the mock HTTP backend', async ({
  page,
}) => {
  const title = 'Server-created task'
  await page.goto('/board/new-task')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Assignee').fill('Avery Stone')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create task' })
    .click()
  await page.reload()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})
