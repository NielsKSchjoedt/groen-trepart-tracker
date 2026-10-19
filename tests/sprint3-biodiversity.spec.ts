import { expect, test } from '@playwright/test';

test.describe('Sprint 3 — biodiversitetslag', () => {
  test('naturkortet læser bio/vns URL-state', async ({ page }) => {
    await page.goto('/natur?bio=maalretning-30&vns=1');

    // Biodiversitetslagene bor nu i det samlede "Lag"-panel. Med bio + vns
    // aktive viser knappen en tæller på 2.
    const lagBtn = page.getByRole('button', { name: /^Lag/ });
    await expect(lagBtn).toBeVisible();
    await expect(lagBtn).toContainText('2');
    await lagBtn.click();
    await expect(page.getByText('Prioriterede naturarealer (30 %)').first()).toBeVisible();
    await expect(page.getByText('Vand, natur & skov 2026').first()).toBeVisible();
  });

  test('data og metode har biodiversitetsafsnit', async ({ page }) => {
    await page.goto('/data-og-metode#biodiversitet');

    await expect(page.getByRole('heading', { name: /Biodiversitet — spor og nøgledokumenter/i })).toBeVisible();
    await expect(page.getByText(/tretrins læsebenchmark/i)).toBeVisible();
    await expect(page.getByText('FULL_DCE=0', { exact: true })).toBeVisible();
  });
});
