import { test, expect } from '@playwright/test';

test.describe('Kommune standings — Sprint 6', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kommuner');
    await expect(page.getByRole('heading', { name: /Fem mål\. Fem ranglister/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('viser rangliste og samlet tabel', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Den fulde liste/i })).toBeVisible();
    await expect(page.getByPlaceholder('Find din kommune i tabellen…')).toBeVisible();
  });

  test('relativ og absolut toggle', async ({ page }) => {
    await page.getByRole('button', { name: 'Absolut' }).click();
    await expect(page.getByText(/Absolut levering/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Ift. ansvar' }).click();
  });

  test('klik på kommune åbner detaljeside', async ({ page }) => {
    const row = page.getByRole('button', { name: /Aabenraa/i }).first();
    await row.click();
    await expect(page).toHaveURL(/\/kommuner\//);
    await expect(page.getByRole('link', { name: /Alle kommuner/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Aabenraa/i, level: 1 })).toBeVisible();
  });

  test('detaljeside virker på mobil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/kommuner/aabenraa');
    await expect(page.getByRole('link', { name: /Alle kommuner/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Beskyttet natur der dyrkes/i).first()).toBeVisible();
  });

  test('sticky nav springer til geografi', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 800));
    const nav = page.getByRole('navigation', { name: 'Spring til sektion' });
    const geografi = nav.getByRole('button', { name: 'Kort', exact: true });
    await expect(geografi).toBeVisible({ timeout: 5000 });
    await geografi.click();
    await expect(page.locator('#geografi')).toBeInViewport({ timeout: 5000 });
  });
});
