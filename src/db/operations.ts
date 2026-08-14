import { db } from './db';
import type { EvidenceSignal, EvidenceRelationship, Source } from './models';
import { generateId } from '../utils/id';
import { verifyExcerptProvenance } from '../services/evidenceIntegrity';
import { calculateScore } from '../services/scoring';

async function updateHypothesisScoresInTransaction(hypothesisIds: Iterable<string | null | undefined>): Promise<void> {
  for (const hypothesisId of new Set([...hypothesisIds].filter((id): id is string => Boolean(id)))) {
    const hypothesis = await db.hypotheses.get(hypothesisId);
    if (!hypothesis) continue;
    const result = calculateScore(await db.evidenceSignals.where('hypothesisId').equals(hypothesisId).toArray());
    await db.hypotheses.update(hypothesisId, {
      confidenceScore: result.score,
      status: result.status,
      lastReviewed: Date.now(),
    });
  }
}

/** Saves canonical source text and revalidates only that source's evidence and linked hypotheses. */
export async function updateSourceTextWithEvidenceRevalidation(sourceId: string, rawText: string): Promise<void> {
  await db.transaction('rw', [db.sources, db.evidenceSignals, db.hypotheses], async () => {
    const source = await db.sources.get(sourceId);
    if (!source) throw new Error('Source not found');
    const sourceEvidence = await db.evidenceSignals.where('sourceId').equals(sourceId).toArray();
    await db.sources.update(sourceId, { rawText });
    for (const signal of sourceEvidence) {
      const provenance = verifyExcerptProvenance(rawText, signal.exactExcerpt);
      await db.evidenceSignals.update(signal.id, {
        exactExcerpt: provenance.matchedExcerpt ?? signal.exactExcerpt,
        provenanceState: provenance.state,
        isDirect: signal.isDirect && provenance.state !== 'unverified',
      });
    }
    await updateHypothesisScoresInTransaction(sourceEvidence.map((signal) => signal.hypothesisId));
  });
}

/** Updates evidence using the persisted source as the only provenance authority. */
export async function updateEvidenceWithCanonicalProvenance(evidenceId: string, updates: Partial<EvidenceSignal>): Promise<void> {
  await db.transaction('rw', [db.sources, db.evidenceSignals, db.hypotheses], async () => {
    const current = await db.evidenceSignals.get(evidenceId);
    if (!current) throw new Error('Evidence signal not found');
    const source = await db.sources.get(current.sourceId);
    if (!source) throw new Error('Evidence source not found');
    const nextHypothesisId = updates.hypothesisId === undefined ? current.hypothesisId : updates.hypothesisId;
    if (nextHypothesisId) {
      const hypothesis = await db.hypotheses.get(nextHypothesisId);
      if (!hypothesis || hypothesis.projectId !== current.projectId) throw new Error('Evidence must link to a hypothesis in the same project');
    }
    const excerpt = typeof updates.exactExcerpt === 'string' ? updates.exactExcerpt : current.exactExcerpt;
    const provenance = verifyExcerptProvenance(source.rawText, excerpt);
    const relationship: EvidenceRelationship = nextHypothesisId ? (updates.relationship ?? current.relationship) : 'neutral';
    await db.evidenceSignals.update(evidenceId, {
      ...updates,
      hypothesisId: nextHypothesisId,
      relationship,
      exactExcerpt: provenance.matchedExcerpt ?? excerpt,
      provenanceState: provenance.state,
      isDirect: (updates.isDirect ?? current.isDirect) && provenance.state !== 'unverified',
    });
    await updateHypothesisScoresInTransaction([current.hypothesisId, nextHypothesisId]);
  });
}

export async function addManualEvidence(source: Source): Promise<EvidenceSignal> {
  const evidence: EvidenceSignal = {
    id: generateId(), projectId: source.projectId, sourceId: source.id, segmentId: source.segmentId,
    hypothesisId: null, relationship: 'neutral', classification: 'pain', statement: 'New observation',
    exactExcerpt: '', isDirect: false, confidence: 5, notes: '', createdAt: Date.now(), provenanceState: 'unverified',
  };
  await db.evidenceSignals.add(evidence);
  return evidence;
}

export async function addAcceptedEvidence(evidence: EvidenceSignal[]): Promise<void> {
  await db.transaction('rw', [db.evidenceSignals, db.hypotheses], async () => {
    await db.evidenceSignals.bulkAdd(evidence);
    await updateHypothesisScoresInTransaction(evidence.map((signal) => signal.hypothesisId));
  });
}

export async function deleteEvidenceCascade(evidenceId: string): Promise<void> {
  await db.transaction('rw', [db.evidenceSignals, db.evidenceDecisionLinks], async () => {
    await db.evidenceDecisionLinks.where('evidenceId').equals(evidenceId).delete();
    await db.evidenceSignals.delete(evidenceId);
  });
}

export async function deleteSourceCascade(sourceId: string): Promise<void> {
  await db.transaction('rw', [db.sources, db.evidenceSignals, db.evidenceDecisionLinks], async () => {
    const evidenceIds = await db.evidenceSignals.where('sourceId').equals(sourceId).primaryKeys();
    if (evidenceIds.length > 0) await db.evidenceDecisionLinks.where('evidenceId').anyOf(evidenceIds).delete();
    await db.evidenceSignals.where('sourceId').equals(sourceId).delete();
    await db.sources.delete(sourceId);
  });
}

export async function deleteHypothesisCascade(hypothesisId: string): Promise<void> {
  await db.transaction('rw', [db.hypotheses, db.evidenceSignals, db.hypothesisDecisionLinks], async () => {
    await db.evidenceSignals.where('hypothesisId').equals(hypothesisId).modify({ hypothesisId: null, relationship: 'neutral' });
    await db.hypothesisDecisionLinks.where('hypothesisId').equals(hypothesisId).delete();
    await db.hypotheses.delete(hypothesisId);
  });
}

export async function deleteDecisionCascade(decisionId: string): Promise<void> {
  await db.transaction('rw', [db.decisions, db.evidenceDecisionLinks, db.hypothesisDecisionLinks], async () => {
    await Promise.all([
      db.evidenceDecisionLinks.where('decisionId').equals(decisionId).delete(),
      db.hypothesisDecisionLinks.where('decisionId').equals(decisionId).delete(),
    ]);
    await db.decisions.delete(decisionId);
  });
}

export async function deleteProjectCascade(projectId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.segments,
      db.sources,
      db.evidenceSignals,
      db.hypotheses,
      db.decisions,
      db.evidenceDecisionLinks,
      db.hypothesisDecisionLinks,
    ],
    async () => {
      await Promise.all([
        db.segments.where('projectId').equals(projectId).delete(),
        db.sources.where('projectId').equals(projectId).delete(),
        db.evidenceSignals.where('projectId').equals(projectId).delete(),
        db.hypotheses.where('projectId').equals(projectId).delete(),
        db.decisions.where('projectId').equals(projectId).delete(),
        db.evidenceDecisionLinks.where('projectId').equals(projectId).delete(),
        db.hypothesisDecisionLinks.where('projectId').equals(projectId).delete(),
      ]);
      await db.projects.delete(projectId);
    },
  );
}
