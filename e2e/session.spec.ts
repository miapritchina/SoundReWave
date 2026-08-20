import { test, expect } from '@playwright/test';

test('full session: record layers, finish, play, and export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('A3', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Record two layers.
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'New Layer' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/^1 layer/)).toBeVisible();

  // Finish the session.
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/finished/)).toBeVisible({ timeout: 5_000 });

  // Play-all control appears.
  await expect(page.getByRole('button', { name: /Play all layers/ })).toBeVisible();

  // Export the SVG artwork → a download fires.
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Art · SVG' }).click();
  expect((await svgDownload).suggestedFilename()).toBe('soundrewave.svg');

  // Export the overlapped WAV → a download fires (proves audio was recorded + mixed).
  const wavDownload = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: /Overlapped WAV/ }).click();
  expect((await wavDownload).suggestedFilename()).toContain('.wav');
});
