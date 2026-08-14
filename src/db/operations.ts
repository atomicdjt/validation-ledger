import { db } from './db';

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
