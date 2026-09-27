import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from 'vitest';
import { db } from '../db/db';
import { createDecisionPackage } from './decisionPackage';
import { createDecisionWithGovernance, updateDecisionWithGovernance } from './governance';

describe('Decision Package Adversarial Tests', () => {
  beforeEach(async () => {
    await db.decisions.clear();
    await db.revisions.clear();
    await db.evidenceSignals.clear();
    await db.hypotheses.clear();
    await db.sources.clear();
    await db.assumptions.clear();
    await db.alternatives.clear();
    await db.risks.clear();
    await db.reviews.clear();
    await db.hypothesisDecisionLinks.clear();
    await db.evidenceDecisionLinks.clear();
  });

  test('Package integrity hash changes when nested content changes', async () => {
    await createDecisionWithGovernance({
      id: 'd1', projectId: 'p1', title: 'A', description: '', reason: 'R', confidence: 'high', status: 'proposed',
      alternatives: '', assumptions: '', validationMethod: '', outcome: '', createdAt: Date.now()
    }, [], [], 'actor', 'create');

    const pkg1 = await createDecisionPackage('d1');
    
    await updateDecisionWithGovernance('d1', { title: 'B' }, 'actor', 'update');
    
    const pkg2 = await createDecisionPackage('d1');
    expect(pkg1.contentHash).not.toBe(pkg2.contentHash);
  });

  test('Package integrity hash handles nested array modifications', async () => {
    await createDecisionWithGovernance({
      id: 'd1', projectId: 'p1', title: 'A', description: '', reason: 'R', confidence: 'high', status: 'proposed',
      alternatives: '', assumptions: '', validationMethod: '', outcome: '', createdAt: Date.now()
    }, [], [], 'actor', 'create');

    const pkg1 = await createDecisionPackage('d1');

    await db.assumptions.add({
      id: 'a1', projectId: 'p1', decisionId: 'd1', statement: 'assume X', status: 'unresolved'
    });

    const pkg2 = await createDecisionPackage('d1');
    expect(pkg1.contentHash).not.toBe(pkg2.contentHash);
  });
});
