import { db } from '../db/db';
import { generateId } from '../utils/id';
import { hashData, buildRevisionHashPayload, hashRevision, findRevisionChainTail } from './integrity';
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

async function previousHashFor(entityId: string): Promise<string> {
  const tail = await findRevisionChainTail(await db.revisions.where('entityId').equals(entityId).toArray());
  return tail?.hash ?? '0';
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
    const previousHash = await previousHashFor(entityId);
    
    const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      entityType,
      entityId,
      projectId,
      timestamp,
      actor,
      previousState,
      newState,
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
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

    const previousHash = await previousHashFor(decisionId);

    const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      'decision',
      decisionId,
      previous.projectId,
      timestamp,
      actor,
      previous,
      updated,
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
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
    const previousHash = await previousHashFor(entity.id);
    
    const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      entityType,
      entity.id,
      entity.projectId,
      timestamp,
      actor,
      null,
      entity,
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
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

    const previousHash = await previousHashFor(entityId);

    const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      entityType,
      entityId,
      previous.projectId,
      timestamp,
      actor,
      previous,
      updated,
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
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
    
    const previousHash = await previousHashFor(finalDecision.id);
    
    const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      'decision',
      finalDecision.id,
      finalDecision.projectId,
      timestamp,
      actor,
      null,
      finalDecision,
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
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
