import { expect, test } from '@playwright/test';

test('enters an abnormal result with keyboard navigation and reviews the report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New report' }).first().click();
  await page.getByRole('button', { name: /Tests/ }).click();
  await page.getByRole('button', { name: /Result entry/ }).click();

  const fastingSugar = page.getByRole('textbox', { name: 'Fasting Blood Sugar result' });
  await fastingSugar.fill('130');
  await fastingSugar.press('Enter');

  await expect(page.getByRole('textbox', { name: 'Glycated Haemoglobin result' })).toBeFocused();
  await expect(page.getByRole('row', { name: /Fasting Blood Sugar/ })).toContainText('High');

  await page.getByRole('button', { name: /Review & print/ }).click();
  await expect(page.getByRole('heading', { name: 'Review before finalizing' })).toBeVisible();
  await expect(page.getByText('Report R127 / V1')).toBeVisible();
});

test('opens immutable version history from the navigation rail', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByText('Current issue')).toBeVisible();
  await expect(page.getByText('Initial issue')).toBeVisible();
});
