import { test, expect } from '@playwright/test';

test('fixed loop mode auto-stops at the loop length and arms for the next', async ({ page }) => {
  await page.goto('/');

  // Open settings, switch to Fixed mode with the shortest length.
  await page.getByRole('button', { name: 'Visual settings' }).click();
  await expect(page.getByTestId('app-version')).toContainText('v'); // build version shown
  await page.getByRole('button', { name: 'Fixed', exact: true }).click();
  await page.getByRole('button', { name: '4s', exact: true }).click();

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('current-note')).toHaveText('A3', { timeout: 10_000 });

  // While recording, the primary button reads "Stop".
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();

  // After the loop length it auto-stops → armed hint + one committed layer.
  await expect(page.getByText(/Take saved/)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/^1 layer/)).toBeVisible();

  // New Layer records the next take.
  await page.getByRole('button', { name: 'New Layer', exact: true }).click();
  await expect(page.getByText(/Take saved/)).toHaveCount(0);
});
