import { expect, test } from '@playwright/test'

test('a browser session creates and reloads a task through the real API', async ({
  page,
}) => {
  const title = `Integration task ${Date.now()}`

  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill('demo')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/board')

  await page.goto('/board/new-task')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Assignee').fill('Integration Tester')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create task' })
    .click()

  await page.reload()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})
