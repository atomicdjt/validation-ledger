import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { injectDemoData } from './demoData';
import { calculateScore } from '../services/scoring';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('guided demo data', () => {
  it('includes a synthetic mixed-evidence project with traceable citations', async () => {
    await injectDemoData();

    const project = (await db.projects.toArray()).find(
      (candidate) => candidate.name === 'Evidence Review Workspace',
    );
    expect(project).toBeDefined();

    const sources = await db.sources.where('projectId').equals(project!.id).toArray();
    const evidence = await db.evidenceSignals.where('projectId').equals(project!.id).toArray();
    const hypothesis = await db.hypotheses.where('projectId').equals(project!.id).first();

    expect(new Set(sources.map((source) => source.participantId)).size).toBe(3);
    expect(evidence).toHaveLength(3);
    expect(evidence.some((signal) => signal.classification === 'willingness_to_pay' && signal.relationship === 'supports')).toBe(true);
    expect(evidence.some((signal) => signal.relationship === 'contradicts')).toBe(true);
    expect(evidence.every((signal) => sources.find((source) => source.id === signal.sourceId)?.rawText.includes(signal.exactExcerpt))).toBe(true);

    const analysis = calculateScore(evidence);
    expect(analysis.status).toBe('mixed');
    expect(hypothesis).toMatchObject({ status: 'mixed', confidenceScore: analysis.score });
  });
});

