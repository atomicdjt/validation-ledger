import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addManualEvidence, deleteDecisionCascade, deleteEvidenceCascade, deleteHypothesisCascade, deleteProjectCascade, deleteSourceCascade, updateEvidenceWithCanonicalProvenance, updateSourceTextWithEvidenceRevalidation } from './operations';

async function seed() {
  await db.projects.add({ id: 'p', name: 'P', productDescription: '', validationObjective: '', stage: '', createdAt: 1, updatedAt: 1 });
  await db.segments.add({ id: 'seg', projectId: 'p', name: 'S', description: '', characteristics: [], priority: 'high' });
  await db.sources.add({ id: 'src', projectId: 'p', participantId: 'A', segmentId: 'seg', date: 1, type: 'interview', rawText: '', metadata: {}, tags: [] });
  await db.hypotheses.add({ id: 'hyp', projectId: 'p', statement: 'H', category: '', importance: 'high', status: 'unvalidated', confidenceScore: 0, createdAt: 1 });
  await db.evidenceSignals.add({ id: 'ev', projectId: 'p', sourceId: 'src', segmentId: 'seg', hypothesisId: 'hyp', relationship: 'supports', classification: 'pain', statement: 'E', exactExcerpt: '', isDirect: false, confidence: 5, notes: '', createdAt: 1, provenanceState: 'unverified' });
  await db.decisions.add({ id: 'dec', projectId: 'p', title: 'D', description: '', reason: '', confidence: 'low', status: 'accepted', alternatives: '', assumptions: '', validationMethod: '', outcome: '', createdAt: 1 });
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

describe('canonical source provenance operations', () => {
  it('revalidates linked evidence, preserves exact excerpts, and updates only affected hypotheses', async () => {
    await db.sources.update('src', { rawText: 'Exact words with  extra spacing.' });
    await db.evidenceSignals.update('ev', { exactExcerpt: 'Exact words', isDirect: true, provenanceState: 'exact' });
    await db.evidenceSignals.add({ id: 'ev2', projectId: 'p', sourceId: 'src', segmentId: 'seg', hypothesisId: 'hyp', relationship: 'supports', classification: 'pain', statement: 'E2', exactExcerpt: 'with extra spacing.', isDirect: true, confidence: 5, notes: '', createdAt: 2, provenanceState: 'normalized' });
    await updateSourceTextWithEvidenceRevalidation('src', 'Exact words with extra spacing.');
    expect(await db.evidenceSignals.get('ev')).toMatchObject({ provenanceState: 'exact', isDirect: true, exactExcerpt: 'Exact words' });
    expect(await db.evidenceSignals.get('ev2')).toMatchObject({ provenanceState: 'exact', isDirect: true, exactExcerpt: 'with extra spacing.' });
    expect((await db.hypotheses.get('hyp'))?.confidenceScore).toBeGreaterThan(0);
  });

  it('downgrades normalized and missing excerpts to unverified and removes direct credit', async () => {
    await db.sources.update('src', { rawText: 'A quote with  spacing.' });
    await db.evidenceSignals.update('ev', { exactExcerpt: 'A quote with spacing.', isDirect: true, provenanceState: 'normalized' });
    await updateSourceTextWithEvidenceRevalidation('src', 'Source changed entirely.');
    expect(await db.evidenceSignals.get('ev')).toMatchObject({ provenanceState: 'unverified', isDirect: false });
    expect((await db.hypotheses.get('hyp'))?.confidenceScore).toBe(20);
  });

  it('uses saved source text, not a transient editor value, when evidence is changed', async () => {
    await db.sources.update('src', { rawText: 'Canonical saved source.' });
    await updateEvidenceWithCanonicalProvenance('ev', { exactExcerpt: 'Transient editor text', isDirect: true });
    expect(await db.evidenceSignals.get('ev')).toMatchObject({ provenanceState: 'unverified', isDirect: false });
  });

  it('creates manual evidence as neutral, unverified, and indirect', async () => {
    const source = await db.sources.get('src');
    const evidence = await addManualEvidence(source!);
    expect(evidence).toMatchObject({ relationship: 'neutral', provenanceState: 'unverified', isDirect: false });
  });
});
