import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function countRecordsByField(page: import('@playwright/test').Page, storeName: string, field: string, expectedValue: string) {
  return page.evaluate(async ({ storeName, field, expectedValue }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ValidationLedgerDatabase');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result.filter((record) => record[field] === expectedValue).length);
      request.onerror = () => reject(request.error);
    });
  }, { storeName, field, expectedValue });
}

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

async function ensureActiveProject(page: import('@playwright/test').Page) {
  const projectSelector = page.getByRole('button', { name: 'Project Select a project' });
  if (await projectSelector.isVisible().catch(() => false)) {
    await page.goto('/projects');
    await page.getByRole('button', { name: /AI Autonomous Agent Platform/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }
}

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
  await expect(page.getByRole('checkbox', { name: 'Direct evidence' })).toBeDisabled();
  await page.getByRole('link', { name: /Decisions/ }).click();
  await page.getByRole('button', { name: /Record Decision/ }).click();
  await page.getByLabel('Decision Title *').fill('Continue validation');
  await page.getByLabel('Alternatives Considered').fill('Stop validation');
  await page.getByLabel('Assumptions').fill('Users care about evidence');
  await page.getByLabel('Validation Method').fill('Ask them');
  await page.getByLabel('Outcome').fill('Validated with the target team');
  await page.getByLabel('Status').selectOption('accepted');
  await page.getByText('New observation').last().click();
  await page.getByRole('button', { name: 'Record Decision' }).last().click();
  await expect(page.getByText('Continue validation')).toBeVisible();
  await expect(page.getByText('Validated with the target team')).toBeVisible();
  await page.getByRole('link', { name: /Report/ }).click();
  await expect(page.getByRole('heading', { name: 'Validation Report' })).toBeVisible();
  await page.getByRole('link', { name: /Settings/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^validation-ledger-backup-/);
});

test('prevents duplicate project creation on a rapid double-click', async ({ page }) => {
  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project name').fill('Single Project');
  await page.getByLabel('Product description').fill('Created once');
  await page.getByLabel('Validation objective').fill('Verify idempotency');

  const createProjectButton = page.getByRole('button', { name: 'Create Project' });
  await Promise.all([createProjectButton.click(), createProjectButton.click()]);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByText('Single Project', { exact: true })).toHaveCount(2);
  const projectCount = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ValidationLedgerDatabase');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number>((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result.filter((project) => project.name === 'Single Project').length);
      request.onerror = () => reject(request.error);
    });
  });
  expect(projectCount).toBe(1);
});

test('prevents duplicate source creation on overlapping submits', async ({ page }) => {
  await page.goto('/sources');
  await ensureActiveProject(page);
  await page.goto('/sources');
  await page.getByRole('button', { name: 'Add Source' }).click();
  await page.getByLabel('Participant / Identifier').fill('Rapid Source');
  const createSourceButton = page.getByRole('button', { name: 'Create & Continue' });
  await Promise.all([createSourceButton.click(), createSourceButton.click()]);
  await expect(page.getByRole('heading', { name: 'Source Detail' })).toBeVisible();
  expect(await countRecordsByField(page, 'sources', 'participantId', 'Rapid Source')).toBe(1);
});

test('prevents duplicate hypothesis creation on overlapping submits', async ({ page }) => {
  await page.goto('/hypotheses');
  await ensureActiveProject(page);
  await page.goto('/hypotheses');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await page.getByLabel('Hypothesis statement').fill('Rapid hypothesis');
  const addHypothesisButton = page.getByRole('button', { name: 'Add Hypothesis' });
  await Promise.all([addHypothesisButton.click(), addHypothesisButton.click()]);
  await expect(page.getByText('Rapid hypothesis', { exact: true })).toBeVisible();
  expect(await countRecordsByField(page, 'hypotheses', 'statement', 'Rapid hypothesis')).toBe(1);
});

test('prevents duplicate decision creation on overlapping submits', async ({ page }) => {
  await page.goto('/decisions');
  await ensureActiveProject(page);
  await page.goto('/decisions');
  await page.getByRole('button', { name: 'Record Decision' }).click();
  await page.getByLabel('Decision Title *').fill('Rapid decision');
  const recordDecisionButton = page.getByRole('button', { name: 'Record Decision' }).last();
  await Promise.all([recordDecisionButton.click(), recordDecisionButton.click()]);
  await expect(page.getByText('Rapid decision', { exact: true })).toBeVisible();
  expect(await countRecordsByField(page, 'decisions', 'title', 'Rapid decision')).toBe(1);
});

test('@responsive mobile core controls retain accessible names and avoid page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/projects');
  await page.locator('article > button').first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const addEvidence = page.getByRole('button', { name: 'Add Evidence' });
  await expect(addEvidence).toBeVisible();
  await expect(addEvidence).toHaveAttribute('title', 'Add Evidence');
  const addEvidenceBox = await addEvidence.boundingBox();
  expect(addEvidenceBox?.width).toBeGreaterThanOrEqual(44);
  expect(addEvidenceBox?.height).toBeGreaterThanOrEqual(44);
  await addEvidence.focus();
  await expect(addEvidence).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto('/report');
  await expect(page.getByRole('heading', { name: 'Validation Report', level: 1 })).toBeVisible();
  await expect(page.locator('.overflow-x-auto')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('@a11y primary routes have no automatically detectable serious violations', async ({ page }) => {
  for (const route of ['/projects', '/settings']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  }
});
