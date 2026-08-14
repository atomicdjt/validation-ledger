import { db } from '../db/db';
import type { EvidenceSignal, Hypothesis } from '../db/models';

type ScorableEvidence = Pick<EvidenceSignal, 'sourceId' | 'segmentId' | 'classification' | 'isDirect'> &
  Partial<Pick<EvidenceSignal, 'relationship' | 'provenanceState'>>;

interface Coverage {
  uniqueSources: number;
  uniqueSegments: number;
  directEvidenceCount: number;
  hasBehavioralEvidence: boolean;
}

export interface HypothesisAnalysis {
  hypothesisId: string;
  score: number;
  supportScore: number;
  counterEvidenceScore: number;
  status: Hypothesis['status'];
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  uniqueSourcesCount: number;
  uniqueSupportingSourcesCount: number;
  uniqueContradictingSourcesCount: number;
  supportCoverage: Coverage;
  counterEvidenceCoverage: Coverage;
  evidenceQuality: Coverage;
  reasons: string[];
}

const BEHAVIORAL_CLASSIFICATIONS = new Set([
  'willingness_to_pay',
  'workaround',
  'current_solution',
]);

function coverageFor(evidence: ReadonlyArray<ScorableEvidence>): Coverage {
  return {
    uniqueSources: new Set(evidence.map((item) => item.sourceId)).size,
    uniqueSegments: new Set(evidence.map((item) => item.segmentId).filter(Boolean)).size,
    directEvidenceCount: evidence.filter((item) => item.isDirect && (item.provenanceState === 'exact' || item.provenanceState === 'normalized')).length,
    hasBehavioralEvidence: evidence.some((item) => BEHAVIORAL_CLASSIFICATIONS.has(item.classification)),
  };
}

function strengthScore(
  evidence: ReadonlyArray<ScorableEvidence>,
  sourcePoints: number,
  sourceCap: number,
): number {
  const coverage = coverageFor(evidence);
  const sourceScore = Math.min(sourceCap, coverage.uniqueSources * sourcePoints);
  const segmentScore = coverage.uniqueSegments >= 2 ? 15 : coverage.uniqueSegments === 1 ? 5 : 0;
  const behaviorScore = coverage.hasBehavioralEvidence ? 15 : 0;
  const directnessScore = Math.min(10, coverage.directEvidenceCount * 2);
  return Math.min(100, sourceScore + segmentScore + behaviorScore + directnessScore);
}

export function calculateScore(evidence: ReadonlyArray<ScorableEvidence>) {
  const supporting = evidence.filter((item) => item.relationship === 'supports');
  const contradicting = evidence.filter((item) => item.relationship === 'contradicts');
  const neutral = evidence.filter((item) => item.relationship !== 'supports' && item.relationship !== 'contradicts');
  const supportCoverage = coverageFor(supporting);
  const counterEvidenceCoverage = coverageFor(contradicting);
  const evidenceQuality = coverageFor(evidence);
  const supportScore = strengthScore(supporting, 15, 60);
  const counterEvidenceScore = strengthScore(contradicting, 20, 60);

  let status: Hypothesis['status'];
  if (supporting.length > 0 && contradicting.length > 0) status = 'mixed';
  else if (contradicting.length > 0) status = 'contradicted';
  else if (supportScore >= 75) status = 'strongly-supported';
  else if (supportScore >= 30) status = 'moderately-supported';
  else if (supportScore > 0) status = 'weak-evidence';
  else status = 'unvalidated';

  const reasons: string[] = [];
  if (supportCoverage.uniqueSources > 0) {
    reasons.push(`${supportCoverage.uniqueSources} independent supporting source${supportCoverage.uniqueSources === 1 ? '' : 's'}.`);
  }
  if (counterEvidenceCoverage.uniqueSources > 0) {
    reasons.push(`${counterEvidenceCoverage.uniqueSources} independent contradicting source${counterEvidenceCoverage.uniqueSources === 1 ? '' : 's'}.`);
  }
  if (neutral.length > 0) reasons.push(`${neutral.length} neutral or unresolved signal${neutral.length === 1 ? '' : 's'}.`);
  if (evidence.length === 0) reasons.push('No evidence gathered yet.');

  return {
    score: supportScore,
    supportScore,
    counterEvidenceScore,
    status,
    supportingCount: supporting.length,
    contradictingCount: contradicting.length,
    neutralCount: neutral.length,
    uniqueSourcesCount: evidenceQuality.uniqueSources,
    uniqueSupportingSourcesCount: supportCoverage.uniqueSources,
    uniqueContradictingSourcesCount: counterEvidenceCoverage.uniqueSources,
    supportCoverage,
    counterEvidenceCoverage,
    evidenceQuality,
    reasons,
  };
}

export async function analyzeHypothesis(hypothesisId: string): Promise<HypothesisAnalysis> {
  const hypothesis = await db.hypotheses.get(hypothesisId);
  if (!hypothesis) throw new Error('Hypothesis not found');
  const evidence = await db.evidenceSignals.where('hypothesisId').equals(hypothesisId).toArray();
  const result = calculateScore(evidence);

  if (hypothesis.confidenceScore !== result.score || hypothesis.status !== result.status) {
    await db.hypotheses.update(hypothesisId, {
      confidenceScore: result.score,
      status: result.status,
      lastReviewed: Date.now(),
    });
  }
  return { hypothesisId, ...result };
}

export async function updateAllHypothesisScores(projectId: string): Promise<void> {
  const hypotheses = await db.hypotheses.where('projectId').equals(projectId).toArray();
  await Promise.all(hypotheses.map((hypothesis) => analyzeHypothesis(hypothesis.id)));
}
