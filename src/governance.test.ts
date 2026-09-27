import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './db/db';
import { createDecisionWithGovernance, updateDecisionWithGovernance, flagDownstreamImpact } from './services/governance';
import { generateId } from './utils/id';

describe('Governance Service', () => {
  beforeEach(async () => {
    await db.revisions.clear();
    await db.decisions.clear();
    await db.evidenceDecisionLinks.clear();
    await db.hypothesisDecisionLinks.clear();
  });

  it('creates a decision and revision', async () => {
    const decision = {
      id: generateId(),
      projectId: 'p1',
      title: 'Test Decision',
      reason: 'Reason',
      confidence: 'high' as const,
      status: 'proposed' as const,
      alternatives: '',
      assumptions: '',
      validationMethod: '',
      outcome: '',
      createdAt: Date.now(),
      description: ''
    };
    await createDecisionWithGovernance(decision, [], [], 'user1', 'Create');
    
    const decisions = await db.decisions.toArray();
    expect(decisions.length).toBe(1);
    expect(decisions[0].integrityHash).toBeDefined();

    const revisions = await db.revisions.toArray();
    expect(revisions.length).toBe(1);
    expect(revisions[0].entityId).toBe(decision.id);
  });
});
