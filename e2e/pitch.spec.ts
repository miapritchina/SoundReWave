import { test, expect } from '@playwright/test';

test('detects the fake A3 tone and draws a contour', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();

  // The note readout should settle on A3 (fake audio is 220 Hz).
  await expect(page.getByText('A3', { exact: true })).toBeVisible({ timeout: 10_000 });

  // A contour path should be drawn in the SVG graph.
  await expect(async () => {
    const paths = await page.locator('svg[aria-label="Layered pitch contour graph"] path').count();
    expect(paths).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
});

test('New Layer commits a take and increments the layer count', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('A3', { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.waitForTimeout(1200); // sing for a beat
  await page.getByRole('button', { name: 'New Layer' }).click();

  await expect(page.getByText(/^1 layer$/)).toBeVisible({ timeout: 5_000 });
});
