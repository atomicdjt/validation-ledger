import { db } from '../db/db';
import type { EvidenceSignal, Hypothesis } from '../db/models';

export interface HypothesisAnalysis {
  hypothesisId: string;
  score: number; // 0 to 100
  status: Hypothesis['status'];
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  uniqueSourcesCount: number;
  uniqueSegmentsCount: number;
  directEvidenceCount: number;
  hasBehavioralEvidence: boolean;
  reasons: string[];
}

export async function analyzeHypothesis(hypothesisId: string): Promise<HypothesisAnalysis> {
  const hypothesis = await db.hypotheses.get(hypothesisId);
  if (!hypothesis) throw new Error('Hypothesis not found');
  const evidence = await db.evidenceSignals.where('hypothesisId').equals(hypothesisId).toArray();

  const result = calculateScore(evidence);

  // Save the updated score and status to the hypothesis
  if (hypothesis.confidenceScore !== result.score || hypothesis.status !== result.status) {
    await db.hypotheses.update(hypothesisId, {
      confidenceScore: result.score,
      status: result.status
    });
  }

  return {
    hypothesisId,
    ...result
  };
}

type ScorableEvidence = Pick<EvidenceSignal, 'sourceId' | 'segmentId' | 'classification' | 'isDirect'> &
  Partial<Pick<EvidenceSignal, 'relationship'>>;

export function calculateScore(evidence: ReadonlyArray<ScorableEvidence>) {
  const supporting = evidence.filter(e => (e.relationship || 'supports') === 'supports');
  const contradicting = evidence.filter(e => e.relationship === 'contradicts');
  const neutral = evidence.filter(e => e.relationship === 'neutral');

  const uniqueSourcesCount = new Set(evidence.map(e => e.sourceId)).size;
  const uniqueSegmentsCount = new Set(evidence.map(e => e.segmentId).filter(Boolean)).size;
  const directEvidenceCount = evidence.filter(e => e.isDirect).length;
  const hasBehavioralEvidence = evidence.some(e =>
    e.classification === 'willingness_to_pay' || e.classification === 'workaround' || e.classification === 'current_solution'
  );

  let score = 0;
  const reasons: string[] = [];

  // Deterministic scoring logic:
  // Base score from supporting unique sources (max 60)
  // Each unique supporting source adds 15 points
  const uniqueSupportingSources = new Set(supporting.map(e => e.sourceId)).size;
  let supportingScore = Math.min(60, uniqueSupportingSources * 15);
  if (uniqueSupportingSources > 0) {
    reasons.push(`+${supportingScore} from ${uniqueSupportingSources} independent supporting sources.`);
  }

  // Segment diversity (max 15)
  let segmentScore = 0;
  if (uniqueSegmentsCount >= 2) {
    segmentScore = 15;
    reasons.push(`+15 from evidence diversity (${uniqueSegmentsCount} segments).`);
  } else if (uniqueSegmentsCount === 1) {
    segmentScore = 5;
    reasons.push(`+5 from evidence limited to 1 segment.`);
  }

  // Behavioral evidence (max 15)
  let behaviorScore = 0;
  if (hasBehavioralEvidence) {
    behaviorScore = 15;
    reasons.push(`+15 for behavioral/pricing evidence.`);
  }

  // Directness (max 10)
  let directnessScore = 0;
  if (directEvidenceCount > 0) {
    directnessScore = Math.min(10, directEvidenceCount * 2);
    reasons.push(`+${directnessScore} for direct evidence citations.`);
  }

  score = supportingScore + segmentScore + behaviorScore + directnessScore;

  // Penalize for contradictions
  const uniqueContradictingSources = new Set(contradicting.map(e => e.sourceId)).size;
  if (uniqueContradictingSources > 0) {
    const penalty = uniqueContradictingSources * 20;
    score = Math.max(0, score - penalty);
    reasons.push(`-${penalty} penalty due to ${uniqueContradictingSources} contradicting sources.`);
  }

  // Determine status based on score and contradictions
  let status: Hypothesis['status'] = 'unvalidated';

  if (uniqueContradictingSources >= 2 && score < 40) {
    status = 'invalidated';
  } else if (score >= 75) {
    status = 'validated';
  } else if (score >= 30 || uniqueContradictingSources > 0) {
    status = 'validating';
  }

  if (evidence.length === 0) {
    reasons.push('No evidence gathered yet.');
  }

  return {
    score,
    status,
    supportingCount: supporting.length,
    contradictingCount: contradicting.length,
    neutralCount: neutral.length,
    uniqueSourcesCount,
    uniqueSegmentsCount,
    directEvidenceCount,
    hasBehavioralEvidence,
    reasons
  };
}

export async function updateAllHypothesisScores(projectId: string) {
  const hypotheses = await db.hypotheses.where('projectId').equals(projectId).toArray();
  await Promise.all(hypotheses.map((hypothesis) => analyzeHypothesis(hypothesis.id)));
}
