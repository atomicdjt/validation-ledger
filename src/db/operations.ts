import { db } from './db';

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
