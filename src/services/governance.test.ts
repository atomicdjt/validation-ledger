import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from 'vitest';
import { db } from '../db/db';
import { createRevision, updateDecisionWithGovernance } from './governance';
import { verifyLedgerIntegrity, hashData, RevisionHashPayload } from './integrity';
import type { Decision, Revision } from '../db/models';
import { generateId } from '../utils/id';

describe('governance adversarial tests', () => {
  beforeEach(async () => {
    await db.revisions.clear();
    await db.decisions.clear();
  });

  test('Valid chain verifies successfully', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '1' }, { title: '2' }, 'update');
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect((result as any).revisionsVerified).toBe(2);
    }
  });

  test('Scenario A: Modify newState in persisted storage without updating hash', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    const revisions = await db.revisions.toArray();
    await db.revisions.update(revisions[0].id, { newState: JSON.stringify({ title: 'Corrupted' }) });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });

  test('Scenario B: Modify reason', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    const revisions = await db.revisions.toArray();
    await db.revisions.update(revisions[0].id, { reason: 'Forged Reason' });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });

  test('Scenario C: Modify actor', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    const revisions = await db.revisions.toArray();
    await db.revisions.update(revisions[0].id, { actor: 'Forged Actor' });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });

  test('Scenario D: Modify timestamp', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    const revisions = await db.revisions.toArray();
    await db.revisions.update(revisions[0].id, { timestamp: 1234567890 });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });

  test('Scenario E: Modify previousHash', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '1' }, { title: '2' }, 'update');
    const revisions = await db.revisions.toArray();
    // Sort by timestamp just in case
    revisions.sort((a, b) => a.timestamp - b.timestamp);
    await db.revisions.update(revisions[1].id, { previousHash: 'forged_prev_hash' });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('PREVIOUS_HASH_MISMATCH');
    }
  });

  test('Scenario F: Delete an intermediate revision', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '1' }, { title: '2' }, 'update1');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '2' }, { title: '3' }, 'update2');
    
    const revisions = await db.revisions.toArray();
    revisions.sort((a, b) => a.timestamp - b.timestamp);
    await db.revisions.delete(revisions[1].id); // delete intermediate
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('PREVIOUS_HASH_MISMATCH');
    }
  });

  test('Scenario H: Insert a forged revision (without valid hash chain)', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    const revisions = await db.revisions.toArray();
    const prevHash = revisions[0].hash;
    
    const forgedRev: Revision = {
      id: generateId(),
      projectId: 'proj1',
      entityType: 'decision',
      entityId: 'ent1',
      timestamp: Date.now() + 100,
      actor: 'actor1',
      previousState: JSON.stringify({ title: '1' }),
      newState: JSON.stringify({ title: 'forged' }),
      reason: 'forged update',
      hash: 'forged_hash',
      previousHash: prevHash,
    };
    await db.revisions.add(forgedRev);
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });
  test('Scenario I: Concurrent writes do not fork the chain', async () => {
    await createRevision('proj1', 'decision', 'ent2', 'actor1', null, { title: 'initial' }, 'create');
    
    // Fire 20 updates concurrently
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(createRevision('proj1', 'decision', 'ent2', 'actor1', { title: 'initial' }, { title: `update-${i}` }, 'concurrent update'));
    }
    await Promise.all(promises);

    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(true);

    const revisions = await db.revisions.where('entityId').equals('ent2').sortBy('timestamp');
    expect(revisions.length).toBe(21);
    
    // Check that each previousHash points to the preceding revision
    for (let i = 1; i < revisions.length; i++) {
      expect(revisions[i].previousHash).toBe(revisions[i - 1].hash);
    }
  });

  test('E2E: Complete causal chain triggers downstream flags and verifies', async () => {
    const { addManualEvidence, updateEvidenceWithCanonicalProvenance } = await import('../db/operations');
    const { createDecisionWithGovernance } = await import('./governance');
    
    // 1. Create source
    const source = { id: 'src1', projectId: 'proj1', participantId: 'p1', segmentId: 's1', date: Date.now(), type: 'interview' as const, rawText: 'This is a quote', metadata: { channel: 'web' }, tags: [] };
    await db.sources.add(source);

    // 2. Create evidence
    const evidence = await addManualEvidence(source);
    
    // 3. Create claim (hypothesis)
    const claim = { id: 'claim1', projectId: 'proj1', statement: 'Users like it', category: 'problem', importance: 'high' as const, status: 'unvalidated' as const, confidenceScore: 0, createdAt: Date.now() };
    await db.hypotheses.add(claim);

    // Link evidence to claim
    await updateEvidenceWithCanonicalProvenance(evidence.id, { hypothesisId: claim.id, exactExcerpt: 'This is a quote' });

    // 4. Create decision
    const decision = { id: 'dec1', projectId: 'proj1', title: 'Let us build it', description: '', reason: 'Good evidence', confidence: 'high' as const, status: 'accepted' as const, alternatives: '', assumptions: '', validationMethod: '', outcome: '', createdAt: Date.now() };
    await createDecisionWithGovernance(decision, [evidence.id], [claim.id], 'system', 'Create decision');

    // Verify initial integrity
    let integrity = await verifyLedgerIntegrity();
    expect(integrity.valid).toBe(true);

    // 5. Upstream evidence change
    await updateEvidenceWithCanonicalProvenance(evidence.id, { validityState: 'contradicted' });

    // 6. Downstream Decision flagged
    const updatedDecision = await db.decisions.get(decision.id);
    expect(updatedDecision?.needsAttention).toBe(true);

    // 7. Verify integrity again
    integrity = await verifyLedgerIntegrity();
    expect(integrity.valid).toBe(true);
  });
});
