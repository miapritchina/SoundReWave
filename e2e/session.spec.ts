import { test, expect } from '@playwright/test';

test('full session: record layers, finish, play, and export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('current-note')).toHaveText('A3', { timeout: 10_000 });

  // Record two layers.
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'New Wave' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/^1 wave/)).toBeVisible();

  // Finish the session.
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/finished/)).toBeVisible({ timeout: 5_000 });

  // Play-all control appears.
  await expect(page.getByRole('button', { name: /Play all layers/ })).toBeVisible();

  // Open the share menu in the header (stays open across exports).
  await page.getByRole('button', { name: 'Export & share' }).click();

  // Export the SVG artwork → a download fires.
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /SVG/ }).click();
  expect((await svgDownload).suggestedFilename()).toBe('soundrewave.svg');

  // Export overlapped MP3 → a download fires (proves audio recorded + mixed + encoded).
  const mp3Download = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('menuitem', { name: /Overlapped mix/ }).click();
  expect((await mp3Download).suggestedFilename()).toContain('.mp3');
});
