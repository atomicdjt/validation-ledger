import { db } from '../db/db';
import { generateId } from '../utils/id';
import { hashData } from './integrity';
import type { Decision, Revision } from '../db/models';

let governanceLock = Promise.resolve();

async function acquireLock() {
  let release: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  const currentLock = governanceLock;
  governanceLock = currentLock.then(() => promise);
  await currentLock;
  return release!;
}

export async function createRevision(
  projectId: string,
  entityType: Revision['entityType'],
  entityId: string,
  actor: string,
  previousState: any,
  newState: any,
  reason: string
): Promise<void> {
  const release = await acquireLock();
  try {
    const previousRevisions = await db.revisions.where('entityId').equals(entityId).sortBy('timestamp');
    const previousHash = previousRevisions.length > 0 ? previousRevisions[previousRevisions.length - 1].hash : '0';
    
    const hash = await hashData({
      entityId,
      timestamp: Date.now(),
      newState,
      previousHash
    });

    const revision: Revision = {
      id: generateId(),
      projectId,
      entityType,
      entityId,
      timestamp: Date.now(),
      actor,
      previousState: JSON.stringify(previousState),
      newState: JSON.stringify(newState),
      reason,
      hash,
      previousHash,
    };

    await db.revisions.add(revision);
  } finally {
    release();
  }
}

export async function updateDecisionWithGovernance(
  decisionId: string,
  updates: Partial<Decision>,
  actor: string,
  reason: string
): Promise<void> {
  const release = await acquireLock();
  try {
    const previous = await db.decisions.get(decisionId);
    if (!previous) throw new Error('Decision not found');

    const updated = { ...previous, ...updates };
    updated.integrityHash = await hashData(updated);

    const previousRevisions = await db.revisions.where('entityId').equals(decisionId).sortBy('timestamp');
    const previousHash = previousRevisions.length > 0 ? previousRevisions[previousRevisions.length - 1].hash : '0';

    const hash = await hashData({
      entityId: decisionId,
      timestamp: Date.now(),
      newState: updated,
      previousHash
    });

    const revision: Revision = {
      id: generateId(),
      projectId: previous.projectId,
      entityType: 'decision',
      entityId: decisionId,
      timestamp: Date.now(),
      actor,
      previousState: JSON.stringify(previous),
      newState: JSON.stringify(updated),
      reason,
      hash,
      previousHash,
    };

    await db.transaction('rw', [db.decisions, db.revisions], async () => {
      await db.decisions.update(decisionId, updated);
      await db.revisions.add(revision);
    });
  } finally {
    release();
  }
}

export async function createEntityWithGovernance<T extends { id: string, projectId: string }>(
  tableName: 'assumptions' | 'alternatives' | 'risks' | 'reviews',
  entityType: Revision['entityType'],
  entity: T,
  actor: string,
  reason: string
): Promise<void> {
  const release = await acquireLock();
  try {
    const previousRevisions = await db.revisions.where('entityId').equals(entity.id).sortBy('timestamp');
    const previousHash = previousRevisions.length > 0 ? previousRevisions[previousRevisions.length - 1].hash : '0';
    
    const hash = await hashData({
      entityId: entity.id,
      timestamp: Date.now(),
      newState: entity,
      previousHash
    });

    const revision: Revision = {
      id: generateId(),
      projectId: entity.projectId,
      entityType,
      entityId: entity.id,
      timestamp: Date.now(),
      actor,
      previousState: JSON.stringify(null),
      newState: JSON.stringify(entity),
      reason,
      hash,
      previousHash,
    };

    await db.transaction('rw', [db[tableName] as any, db.revisions], async () => {
      await (db[tableName] as any).add(entity);
      await db.revisions.add(revision);
    });
  } finally {
    release();
  }
}

export async function updateEntityWithGovernance<T extends { id: string, projectId: string }>(
  tableName: 'assumptions' | 'alternatives' | 'risks' | 'reviews',
  entityType: Revision['entityType'],
  entityId: string,
  updates: Partial<T>,
  actor: string,
  reason: string
): Promise<void> {
  const release = await acquireLock();
  try {
    const previous = await (db[tableName] as any).get(entityId);
    if (!previous) throw new Error('Entity not found');

    const updated = { ...previous, ...updates };

    const previousRevisions = await db.revisions.where('entityId').equals(entityId).sortBy('timestamp');
    const previousHash = previousRevisions.length > 0 ? previousRevisions[previousRevisions.length - 1].hash : '0';

    const hash = await hashData({
      entityId,
      timestamp: Date.now(),
      newState: updated,
      previousHash
    });

    const revision: Revision = {
      id: generateId(),
      projectId: previous.projectId,
      entityType,
      entityId,
      timestamp: Date.now(),
      actor,
      previousState: JSON.stringify(previous),
      newState: JSON.stringify(updated),
      reason,
      hash,
      previousHash,
    };

    await db.transaction('rw', [db[tableName] as any, db.revisions], async () => {
      await (db[tableName] as any).update(entityId, updated);
      await db.revisions.add(revision);
    });
  } finally {
    release();
  }
}

export async function createDecisionWithGovernance(
  decision: Decision,
  evidenceIds: string[],
  hypothesisIds: string[],
  actor: string,
  reason: string
): Promise<void> {
  const release = await acquireLock();
  try {
    const finalDecision = { ...decision };
    finalDecision.integrityHash = await hashData(finalDecision);
    
    const previousRevisions = await db.revisions.where('entityId').equals(finalDecision.id).sortBy('timestamp');
    const previousHash = previousRevisions.length > 0 ? previousRevisions[previousRevisions.length - 1].hash : '0';
    
    const hash = await hashData({
      entityId: finalDecision.id,
      timestamp: Date.now(),
      newState: finalDecision,
      previousHash
    });

    const revision: Revision = {
      id: generateId(),
      projectId: finalDecision.projectId,
      entityType: 'decision',
      entityId: finalDecision.id,
      timestamp: Date.now(),
      actor,
      previousState: JSON.stringify(null),
      newState: JSON.stringify(finalDecision),
      reason,
      hash,
      previousHash,
    };

    await db.transaction('rw', [db.decisions, db.hypothesisDecisionLinks, db.evidenceDecisionLinks, db.revisions], async () => {
      await db.decisions.add(finalDecision);
      for (const hId of hypothesisIds) {
        await db.hypothesisDecisionLinks.add({ id: generateId(), projectId: finalDecision.projectId, hypothesisId: hId, decisionId: finalDecision.id });
      }
      for (const eId of evidenceIds) {
        await db.evidenceDecisionLinks.add({ id: generateId(), projectId: finalDecision.projectId, evidenceId: eId, decisionId: finalDecision.id });
      }
      await db.revisions.add(revision);
    });
  } finally {
    release();
  }
}

export async function flagDownstreamImpact(evidenceId: string): Promise<void> {
  const links = await db.evidenceDecisionLinks.where('evidenceId').equals(evidenceId).toArray();
  const evidence = await db.evidenceSignals.get(evidenceId);
  const hypothesisId = evidence?.hypothesisId;
  const hLinks = hypothesisId ? await db.hypothesisDecisionLinks.where('hypothesisId').equals(hypothesisId).toArray() : [];
  
  const decisionIds = new Set<string>([...links.map(l => l.decisionId), ...hLinks.map(l => l.decisionId)]);
  for (const dId of decisionIds) {
    const decision = await db.decisions.get(dId);
    if (decision && !decision.needsAttention) {
      await updateDecisionWithGovernance(
        dId,
        { needsAttention: true },
        'system',
        `Upstream evidence ${evidenceId} changed status`
      );
    }
  }
}
