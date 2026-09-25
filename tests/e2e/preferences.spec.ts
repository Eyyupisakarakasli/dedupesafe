import { test, expect } from '@playwright/test'

for (const locale of [
  { code: 'en', language: 'Language', theme: 'Appearance', heading: 'Review duplicate contacts.', scan: 'Scan 15 contacts', results: 'Scan Complete' },
  { code: 'tr', language: 'Dil', theme: 'Görünüm', heading: 'Kişi tekrarlarını inceleyin.', scan: '15 kişiyi tekrarlar için tara', results: 'İncelemeye hazır' },
  { code: 'de', language: 'Sprache', theme: 'Darstellung', heading: 'Kontaktduplikate prüfen.', scan: '15 Kontakte auf Duplikate prüfen', results: 'Bereit zur Prüfung' },
]) {
  test(`${locale.code}: language and appearance persist across pages without changing review`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption(locale.code)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(locale.heading)
    await page.getByRole('combobox', { name: locale.theme, exact: true }).selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    for (const path of ['/privacy/', '/limitations/']) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', locale.code)
      await expect(page.getByRole('combobox', { name: locale.theme, exact: true })).toHaveValue('dark')
    }
    await page.goto('/app/?demo=1')
    await page.getByRole('button', { name: new RegExp(locale.scan) }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale.results)
    await expect(page.getByRole('cell', { name: 'charlie@test.com', exact: true }).first()).toBeVisible()
    await page.getByRole('combobox', { name: locale.theme, exact: true }).selectOption('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale.results)
    await page.reload()
    await expect(page.getByRole('combobox', { name: locale.language, exact: true })).toHaveValue(locale.code)
    await expect(page.getByRole('combobox', { name: locale.theme, exact: true })).toHaveValue('light')
  })
}

