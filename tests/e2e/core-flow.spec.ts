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
  await page.goto('/projects');
  const demoCard = page.locator('article > button').filter({ hasText: 'AI Autonomous Agent Platform' }).first();
  await expect(demoCard).toBeVisible();
  await demoCard.click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function addFictionalResearchEvidence(
  page: import('@playwright/test').Page,
  identifier: string,
  quote: string,
  claim: string,
  relationship: 'Supports' | 'Contradicts',
) {
  await page.getByRole('link', { name: /Sources/ }).click();
  await page.getByRole('button', { name: 'Add Source' }).click();
  await page.getByLabel('Participant / Identifier').fill(identifier);
  await page.getByRole('button', { name: 'Create & Continue' }).click();
  await page.getByLabel('Transcript or notes').fill(quote);
  await page.getByRole('button', { name: 'Save Notes' }).click();
  await page.getByRole('button', { name: 'Add Manual' }).click();
  await page.getByLabel('Observation Summary').fill(`${relationship} signal from synthetic interview material.`);
  await page.getByLabel('Provenance Quote').fill(quote);
  await expect(page.getByText('exact', { exact: true })).toBeVisible();
  const directEvidence = page.getByRole('checkbox', { name: 'Direct evidence' });
  await expect(directEvidence).toBeEnabled();
  if (!(await directEvidence.isChecked())) await directEvidence.click();
  await expect(directEvidence).toBeChecked();
  await page.getByLabel('Link to Hypothesis').selectOption({ label: claim });
  const relationshipButton = page.getByRole('button', { name: relationship, exact: true });
  await relationshipButton.click();
  await expect(relationshipButton).toHaveAttribute('aria-pressed', 'true');
}

test('creates a traceable source-to-decision workflow and exports a backup', async ({ page }) => {
  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project name').fill('E2E Validation');
  await page.getByLabel('Product description').fill('Browser-tested workflow');
  await page.getByLabel('Validation objective').fill('Verify traceability');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: /Claims/ }).click();
  await page.getByRole('button', { name: 'Add Claim' }).click();
  await page.getByLabel('Claim statement').fill('Teams need auditable evidence');
  await page.getByRole('button', { name: 'Add Claim' }).click();
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

test('researcher exercise preserves exact support and counterevidence in a proposed decision', async ({ page }) => {
  const claim = 'Small independent grocers will pay for a shared board that flags substitutions before packing.';
  const ownerA = 'I would pay for a shared board if it flags a substitution before packing. Last month, two shoppers arrived after we swapped an item without telling them. It has to take less than a minute per order.';
  const ownerB = 'We tried a substitution message for every item last month. Staff spent more time answering replies than packing, and I would not pay for another dashboard.';

  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project name').fill('Maple Market substitutions');
  await page.getByLabel('Product description').fill('A pickup-order board that flags substitutions before packing.');
  await page.getByLabel('Validation objective').fill('Check whether independent grocers need a staff substitution workflow.');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: /Claims/ }).click();
  await page.getByRole('button', { name: 'Add Claim' }).click();
  await page.getByLabel('Claim statement').fill(claim);
  await page.getByRole('button', { name: 'Add Claim' }).click();

  await addFictionalResearchEvidence(page, 'Fictional market owner A', ownerA, claim, 'Supports');
  await addFictionalResearchEvidence(page, 'Fictional market owner B', ownerB, claim, 'Contradicts');
  await page.getByRole('link', { name: /Claims/ }).click();
  await expect(page.getByText('mixed', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Decisions/ }).click();
  await page.getByRole('button', { name: 'Record Decision' }).click();
  await page.getByLabel('Decision Title *').fill('Run a workflow test before pricing');
  await page.getByLabel('Alternatives Considered').fill('Launch the paid board now; stop work.');
  await page.getByLabel('Assumptions').fill('A triage workflow can reduce interruptions without adding staff work.');
  await page.getByLabel('Validation Method').fill('Observe a short prototype workflow.');
  await page.getByLabel('Outcome').fill('Synthetic exercise only; this establishes no real demand.');
  await page.getByLabel('Status').selectOption('proposed');
  await page.getByLabel('Confidence').selectOption('low');
  await page.locator('label').filter({ hasText: claim }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Supports signal from synthetic interview material.' }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Contradicts signal from synthetic interview material.' }).locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Record Decision' }).last().click();
  await expect(page.getByText('Run a workflow test before pricing', { exact: true })).toBeVisible();
  await expect(page.getByText('proposed', { exact: true })).toBeVisible();
  await expect(page.getByText('low Confidence', { exact: true })).toBeVisible();
  await expect(page.locator('[title="1 hypotheses and 2 evidence signals linked"]')).toBeVisible();
});

test('restores a valid backup and replaces the current local workspace', async ({ page }) => {
  await page.route('https://**', (route) => route.abort());
  const blockedExternalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') blockedExternalRequests.push(request.url());
  });

  const backup = {
    formatVersion: 2,
    exportedAt: new Date(0).toISOString(),
    projects: [{ id: 'fictional-restore', name: 'Restored fictional workspace', productDescription: 'A synthetic product research exercise.', validationObjective: 'Check that a local backup can be restored.', stage: 'idea', createdAt: 1, updatedAt: 1 }],
    segments: [], sources: [], evidenceSignals: [], hypotheses: [], decisions: [],
    evidenceDecisionLinks: [], hypothesisDecisionLinks: [], revisions: [], assumptions: [], alternatives: [], risks: [], reviews: [],
  };

  await page.goto('/settings');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByPlaceholder('Paste backup JSON here…').fill(JSON.stringify(backup));
  await Promise.all([
    page.waitForURL('http://127.0.0.1:4173/'),
    page.getByRole('button', { name: 'Restore Backup' }).click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/projects');
  await expect(page.locator('article > button').filter({ hasText: 'Restored fictional workspace' })).toHaveCount(1);
  await expect(page.locator('article > button').filter({ hasText: 'AI Autonomous Agent Platform' })).toHaveCount(0);
  expect(blockedExternalRequests).toEqual([]);
});

test('rejects malformed restore input without deleting the existing workspace', async ({ page }) => {
  await page.goto('/settings');
  const before = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ValidationLedgerDatabase');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number>((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByPlaceholder('Paste backup JSON here…').fill('{not json');
  await page.getByRole('button', { name: 'Restore Backup' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid backup: file is not valid JSON.');
  const after = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ValidationLedgerDatabase');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number>((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(before).toBeGreaterThan(0);
  expect(after).toBe(before);
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
  await ensureActiveProject(page);
  await page.getByRole('link', { name: /Sources/ }).click();
  await expect(page.getByRole('button', { name: 'Add Source' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Source' }).click();
  await page.getByLabel('Participant / Identifier').fill('Rapid Source');
  const createSourceButton = page.getByRole('button', { name: 'Create & Continue' });
  await Promise.all([createSourceButton.click(), createSourceButton.click()]);
  await expect(page.getByRole('heading', { name: 'Source Detail' })).toBeVisible();
  expect(await countRecordsByField(page, 'sources', 'participantId', 'Rapid Source')).toBe(1);
});

test('prevents duplicate hypothesis creation on overlapping submits', async ({ page }) => {
  await ensureActiveProject(page);
  await page.getByRole('link', { name: /Claims/ }).click();
  await expect(page.getByRole('button', { name: 'Add Claim' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Claim' }).click();
  await page.getByLabel('Claim statement').fill('Rapid claim');
  const addHypothesisButton = page.getByRole('button', { name: 'Add Claim' });
  await Promise.all([addHypothesisButton.click(), addHypothesisButton.click()]);
  await expect(page.getByText('Rapid claim', { exact: true })).toBeVisible();
  expect(await countRecordsByField(page, 'hypotheses', 'statement', 'Rapid claim')).toBe(1);
});

test('prevents duplicate decision creation on overlapping submits', async ({ page }) => {
  await ensureActiveProject(page);
  await page.getByRole('link', { name: /Decisions/ }).click();
  await expect(page.getByRole('button', { name: 'Record Decision' })).toBeVisible();
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

