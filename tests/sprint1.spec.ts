import { test, expect } from '@playwright/test';

test.describe('Sprint 1 — UI', () => {
  test('forsiden viser budget-kapacitet med drift-pill', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Budget & kapacitet' })).toBeVisible();
    const drift = page.getByText('Drift-finansiering: Ikke afsat');
    await expect(drift.first()).toBeVisible();
  });

  test('Klimarådet-badge på lavbund-pille', async ({ page }) => {
    await page.goto('/');
    // Delmålskort: undgå de mindre statusknapper; vælg hovedkortet med ramme
    const lavbundCard = page
      .locator('div[role="button"].rounded-xl')
      .filter({ hasText: 'Lavbundsarealer' })
      .first();
    const badge = lavbundCard.getByRole('button', { name: /Klimarådet: Væsentlig/ });
    await expect(badge).toBeVisible();
    await badge.click();
    await expect(page.getByText(/væsentlig risiko for/i).first()).toBeVisible();
  });

  test('initiativtype: skift mellem areal og antal (skov-detalje)', async ({ page }) => {
    await page.goto('/skovrejsning');
    const toggle = page.getByRole('button', { name: 'Vis projekt-antal' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByText(/projekter fordelt efter ordningstype/i).first()).toBeVisible();
  });

  test('Countdown: fase-blind note på skov', async ({ page }) => {
    await page.goto('/skovrejsning');
    await expect(page.getByText('Lineær fremskrivning er fase-blind').first()).toBeVisible();
  });
});
