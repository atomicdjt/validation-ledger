import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { injectDemoData } from './demoData';
import { calculateScore } from '../services/scoring';
import { useStore } from '../store/useStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('guided demo data', () => {
  it('includes a synthetic project with traceable citations', async () => {
    await injectDemoData();

    const existingProject = (await db.projects.toArray()).find(
      (candidate) => candidate.name === 'AI Autonomous Agent Platform',
    );
    expect(existingProject).toBeDefined();
    const existingDecision = await db.decisions.where('projectId').equals(existingProject!.id).first();
    expect(existingDecision).toBeDefined();
    expect(await db.assumptions.where('decisionId').equals(existingDecision!.id).count()).toBe(2);
    expect(await db.alternatives.where('decisionId').equals(existingDecision!.id).count()).toBe(3);
    expect(await db.risks.where('decisionId').equals(existingDecision!.id).count()).toBe(1);
    expect(await db.reviews.where('decisionId').equals(existingDecision!.id).count()).toBe(1);
    expect(useStore.getState().activeProjectId).toBe(existingProject!.id);

    const project = (await db.projects.toArray()).find(
      (candidate) => candidate.name === 'AI Autonomous Agent Platform',
    );
    expect(project).toBeDefined();

    const sources = await db.sources.where('projectId').equals(project!.id).toArray();
    const evidence = await db.evidenceSignals.where('projectId').equals(project!.id).toArray();
    const hypotheses = await db.hypotheses.where('projectId').equals(project!.id).toArray();
    const decisions = await db.decisions.where('projectId').equals(project!.id).toArray();

    expect(new Set(sources.map((source) => source.participantId)).size).toBe(2);
    expect(evidence).toHaveLength(2);
    expect(evidence.some((signal) => signal.relationship === 'supports')).toBe(true);
    expect(evidence.every((signal) => sources.find((source) => source.id === signal.sourceId)?.rawText.includes(signal.exactExcerpt))).toBe(true);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      title: 'Implement Risk-Tiered Execution Architecture',
      status: 'accepted',
      confidence: 'high',
    });

    const decisionId = decisions[0].id;
    expect(await db.hypothesisDecisionLinks.where('decisionId').equals(decisionId).count()).toBe(2);
    expect(await db.evidenceDecisionLinks.where('decisionId').equals(decisionId).count()).toBe(2);
  });
});

