import { expect, test } from '@playwright/test';

test.describe('Sprint 3 — biodiversitetslag', () => {
  test('naturkortet læser bio/vns URL-state', async ({ page }) => {
    await page.goto('/natur?bio=maalretning-30,transform-co2&vns=1');

    await expect(page.getByRole('button', { name: /Biodiversitet/i })).toBeVisible();
    await expect(page.getByText('Målretning 30 %').first()).toBeVisible();
    await expect(page.getByText('TRANSFORM — CO₂').first()).toBeVisible();
    await expect(page.getByText('VNS 2026').first()).toBeVisible();
  });

  test('data og metode har biodiversitetsafsnit', async ({ page }) => {
    await page.goto('/data-og-metode#biodiversitet');

    await expect(page.getByRole('heading', { name: /Biodiversitet — spor og nøgledokumenter/i })).toBeVisible();
    await expect(page.getByText(/tretrins læsebenchmark/i)).toBeVisible();
    await expect(page.getByText('FULL_DCE=0', { exact: true })).toBeVisible();
  });
});
