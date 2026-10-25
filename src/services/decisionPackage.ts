import { db } from '../db/db';
import { hashData } from './integrity';

export async function createDecisionPackage(decisionId: string) {
  const decision = await db.decisions.get(decisionId);
  if (!decision) throw new Error('Decision not found');

  const hypothesesLinks = await db.hypothesisDecisionLinks.where('decisionId').equals(decisionId).toArray();
  const claims = await db.hypotheses.where('id').anyOf(hypothesesLinks.map(l => l.hypothesisId)).toArray();

  const evidenceLinks = await db.evidenceDecisionLinks.where('decisionId').equals(decisionId).toArray();
  const explicitEvidence = await db.evidenceSignals.where('id').anyOf(evidenceLinks.map(l => l.evidenceId)).toArray();

  const claimsEvidence = await db.evidenceSignals.where('hypothesisId').anyOf(claims.map(c => c.id)).toArray();
  
  const allEvidence = [...explicitEvidence, ...claimsEvidence];
  const uniqueEvidence = Array.from(new Map(allEvidence.map(e => [e.id, e])).values());

  const sources = await db.sources.where('id').anyOf(uniqueEvidence.map(e => e.sourceId)).toArray();

  const revisions = await db.revisions.where('entityId').equals(decisionId).toArray();
  
  const assumptions = await db.assumptions.where('decisionId').equals(decisionId).toArray();
  const alternatives = await db.alternatives.where('decisionId').equals(decisionId).toArray();
  const risks = await db.risks.where('decisionId').equals(decisionId).toArray();
  const reviews = await db.reviews.where('decisionId').equals(decisionId).toArray();

  const content = {
    schemaVersion: "1.0",
    decision,
    claims,
    evidence: uniqueEvidence,
    sources,
    assumptions,
    alternatives,
    risks,
    reviews,
    revisions,
  };

  const contentHash = await hashData(content);

  return {
    contentHash,
    generatedAt: Date.now(),
    ...content,
  };
}
