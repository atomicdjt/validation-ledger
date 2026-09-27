import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/db';
import { createRevision } from './governance';
import { buildRevisionHashPayload, hashRevision, verifyLedgerIntegrity, verifyRevisionChains } from './integrity';
import type { Revision } from '../db/models';
import { generateId } from '../utils/id';

async function hashedRevision(id: string, previousHash: string, newState: unknown): Promise<Revision> {
  const payload = buildRevisionHashPayload('decision', 'ent1', 'proj1', 1, 'actor1', {}, newState, `revision ${id}`, previousHash);
  return {
    id, projectId: 'proj1', entityType: 'decision', entityId: 'ent1', timestamp: 1, actor: 'actor1',
    previousState: JSON.stringify({}), newState: JSON.stringify(newState), reason: `revision ${id}`,
    hash: await hashRevision(payload), previousHash,
  };
}

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
    const genesis = revisions.find((revision) => revision.previousHash === '0')!;
    const successor = revisions.find((revision) => revision.previousHash === genesis.hash)!;
    await db.revisions.update(successor.id, { previousHash: 'forged_prev_hash' });
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('HASH_MISMATCH');
    }
  });

  test('Scenario F: Delete an intermediate revision', async () => {
    await createRevision('proj1', 'decision', 'ent1', 'actor1', null, { title: '1' }, 'create');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '1' }, { title: '2' }, 'update1');
    await createRevision('proj1', 'decision', 'ent1', 'actor1', { title: '2' }, { title: '3' }, 'update2');
    
    const revisions = await db.revisions.toArray();
    const genesis = revisions.find((revision) => revision.previousHash === '0')!;
    const middle = revisions.find((revision) => revision.previousHash === genesis.hash)!;
    const finalRevision = revisions.find((revision) => revision.previousHash === middle.hash)!;
    expect(finalRevision).toBeTruthy();
    await db.revisions.delete(middle.id);
    
    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect((result as any).reason).toBe('MISSING_PREDECESSOR');
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
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      await createRevision('proj1', 'decision', 'ent2', 'actor1', null, { title: 'initial' }, 'create');

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(createRevision('proj1', 'decision', 'ent2', 'actor1', { title: 'initial' }, { title: `update-${i}` }, 'concurrent update'));
      }
      await Promise.all(promises);
    } finally {
      now.mockRestore();
    }

    const result = await verifyLedgerIntegrity();
    expect(result.valid).toBe(true);

    const revisions = await db.revisions.where('entityId').equals('ent2').toArray();
    expect(revisions.length).toBe(21);

    const genesis = revisions.filter((revision) => revision.previousHash === '0');
    expect(genesis).toHaveLength(1);
    const successors = new Map<string, Revision[]>();
    for (const revision of revisions.filter((revision) => revision.previousHash !== '0')) {
      const linked = successors.get(revision.previousHash) ?? [];
      linked.push(revision);
      successors.set(revision.previousHash, linked);
    }
    expect([...successors.values()].every((linked) => linked.length === 1)).toBe(true);

    const visited = new Set<string>();
    let current: Revision | undefined = genesis[0];
    while (current) {
      visited.add(current.hash);
      current = successors.get(current.hash)?.[0];
    }
    expect(visited.size).toBe(21);
  });

  test('topology verifier rejects validly hashed forks, duplicate hashes, and multiple genesis revisions', async () => {
    const genesis = await hashedRevision('r1', '0', { title: 'first' });
    const successor = await hashedRevision('r2', genesis.hash, { title: 'second' });
    const fork = await hashedRevision('r3', genesis.hash, { title: 'fork' });
    const forkResult = await verifyRevisionChains([genesis, successor, fork]);
    expect(forkResult).toMatchObject({ valid: false, reason: 'CHAIN_FORK' });

    const duplicateResult = await verifyRevisionChains([genesis, successor, { ...successor, id: 'r2-copy' }]);
    expect(duplicateResult).toMatchObject({ valid: false, reason: 'DUPLICATE_HASH' });

    const secondGenesis = await hashedRevision('r4', '0', { title: 'another root' });
    const multipleGenesisResult = await verifyRevisionChains([genesis, secondGenesis]);
    expect(multipleGenesisResult).toMatchObject({ valid: false, reason: 'MULTIPLE_GENESIS' });
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
