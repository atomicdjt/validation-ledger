import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteDecisionCascade, deleteEvidenceCascade, deleteHypothesisCascade, deleteProjectCascade, deleteSourceCascade } from './operations';

async function seed() {
  await db.projects.add({ id: 'p', name: 'P', productDescription: '', validationObjective: '', stage: '', createdAt: 1, updatedAt: 1 });
  await db.segments.add({ id: 'seg', projectId: 'p', name: 'S', description: '', characteristics: [], priority: 'high' });
  await db.sources.add({ id: 'src', projectId: 'p', participantId: 'A', segmentId: 'seg', date: 1, type: 'interview', rawText: '', metadata: {}, tags: [] });
  await db.hypotheses.add({ id: 'hyp', projectId: 'p', statement: 'H', category: '', importance: 'high', status: 'unvalidated', confidenceScore: 0, createdAt: 1 });
  await db.evidenceSignals.add({ id: 'ev', projectId: 'p', sourceId: 'src', segmentId: 'seg', hypothesisId: 'hyp', relationship: 'supports', classification: 'pain', statement: 'E', exactExcerpt: '', isDirect: false, confidence: 5, notes: '', createdAt: 1, provenanceState: 'unverified' });
  await db.decisions.add({ id: 'dec', projectId: 'p', title: 'D', description: '', reason: '', confidence: 'low', createdAt: 1 });
  await db.evidenceDecisionLinks.add({ id: 'edl', projectId: 'p', evidenceId: 'ev', decisionId: 'dec' });
  await db.hypothesisDecisionLinks.add({ id: 'hdl', projectId: 'p', hypothesisId: 'hyp', decisionId: 'dec' });
}

beforeEach(async () => { await db.delete(); await db.open(); await seed(); });

describe('cascade-safe deletes', () => {
  it('deletes evidence links with evidence', async () => { await deleteEvidenceCascade('ev'); expect(await db.evidenceDecisionLinks.count()).toBe(0); });
  it('deletes a source, its evidence, and downstream links', async () => { await deleteSourceCascade('src'); expect(await db.sources.count()).toBe(0); expect(await db.evidenceSignals.count()).toBe(0); expect(await db.evidenceDecisionLinks.count()).toBe(0); });
  it('unlinks evidence neutrally and deletes hypothesis links', async () => { await deleteHypothesisCascade('hyp'); expect(await db.evidenceSignals.get('ev')).toMatchObject({ hypothesisId: null, relationship: 'neutral' }); expect(await db.hypothesisDecisionLinks.count()).toBe(0); });
  it('deletes both kinds of decision links', async () => { await deleteDecisionCascade('dec'); expect(await db.evidenceDecisionLinks.count()).toBe(0); expect(await db.hypothesisDecisionLinks.count()).toBe(0); });
  it('removes every project-owned row', async () => { await deleteProjectCascade('p'); expect(await Promise.all([db.projects.count(), db.segments.count(), db.sources.count(), db.evidenceSignals.count(), db.hypotheses.count(), db.decisions.count(), db.evidenceDecisionLinks.count(), db.hypothesisDecisionLinks.count()])).toEqual([0,0,0,0,0,0,0,0]); });
});
