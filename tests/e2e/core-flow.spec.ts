import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/projects');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('ValidationLedgerDatabase');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
});

test('creates a traceable source-to-decision workflow and exports a backup', async ({ page }) => {
  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project name').fill('E2E Validation');
  await page.getByLabel('Product description').fill('Browser-tested workflow');
  await page.getByLabel('Validation objective').fill('Verify traceability');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: /Hypotheses/ }).click();
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await page.getByLabel('Hypothesis statement').fill('Teams need auditable evidence');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await page.getByRole('link', { name: /Sources/ }).click();
  await page.getByRole('button', { name: /Add Source/ }).click();
  await page.getByLabel('Participant / Identifier').fill('Participant E2E');
  await page.getByRole('button', { name: 'Create & Continue' }).click();
  await page.getByLabel('Transcript or notes').fill('Our team needs an auditable evidence trail.');
  await page.getByRole('button', { name: /Save Notes/ }).click();
  await page.getByRole('button', { name: /Add Manual/ }).click();
  await expect(page.getByText('New observation')).toBeVisible();
  await page.getByRole('link', { name: /Decisions/ }).click();
  await page.getByRole('button', { name: /Record Decision/ }).click();
  await page.getByLabel('Decision Title *').fill('Continue validation');
  await page.getByRole('button', { name: 'Record Decision' }).last().click();
  await expect(page.getByText('Continue validation')).toBeVisible();
  await page.getByRole('link', { name: /Report/ }).click();
  await expect(page.getByRole('heading', { name: 'Validation Report' })).toBeVisible();
  await page.getByRole('link', { name: /Settings/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^validation-ledger-backup-/);
});

test('@a11y primary routes have no automatically detectable serious violations', async ({ page }) => {
  for (const route of ['/projects', '/settings']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  }
});
