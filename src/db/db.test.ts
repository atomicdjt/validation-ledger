import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ValidationLedgerDatabase } from './db';

const legacyStores = {
  projects: 'id, createdAt, updatedAt',
  segments: 'id, projectId, priority',
  sources: 'id, projectId, segmentId, date, type',
  evidenceSignals: 'id, projectId, sourceId, segmentId, hypothesisId, classification, confidence',
  hypotheses: 'id, projectId, category, importance, status, confidenceScore',
  decisions: 'id, projectId, createdAt',
  evidenceDecisionLinks: 'id, projectId, evidenceId, decisionId',
  hypothesisDecisionLinks: 'id, projectId, hypothesisId, decisionId',
};

describe('Dexie version 3 migration', () => {
  beforeEach(async () => {
    await db.delete();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('upgrades a real pre-v3 Decision and preserves legacy data', async () => {
    const legacy = new Dexie('ValidationLedgerDatabase');
    legacy.version(2).stores(legacyStores);
    await legacy.open();
    await legacy.table('projects').add({
      id: 'legacy-project',
      name: 'Legacy project',
      productDescription: 'Original description',
      validationObjective: 'Original objective',
      stage: 'discovery',
      createdAt: 10,
      updatedAt: 20,
    });
    await legacy.table('decisions').add({
      id: 'legacy-decision',
      projectId: 'legacy-project',
      title: 'Keep the original workflow',
      description: 'Legacy summary',
      reason: 'Legacy reason',
      confidence: 'high',
      createdAt: 30,
      reviewDate: 40,
    });
    legacy.close();

    const migrated = new ValidationLedgerDatabase();
    await migrated.open();
    const decision = await migrated.decisions.get('legacy-decision');
    const project = await migrated.projects.get('legacy-project');

    expect(project).toMatchObject({ name: 'Legacy project', validationObjective: 'Original objective' });
    expect(decision).toMatchObject({
      id: 'legacy-decision',
      projectId: 'legacy-project',
      title: 'Keep the original workflow',
      description: 'Legacy summary',
      reason: 'Legacy reason',
      confidence: 'high',
      status: 'accepted',
      alternatives: '',
      assumptions: '',
      validationMethod: '',
      outcome: '',
      createdAt: 30,
      reviewDate: 40,
    });
    await migrated.close();
  });
});
