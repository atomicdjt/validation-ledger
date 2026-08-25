import { describe, expect, it } from 'vitest';
import type { EvidenceSignal } from '../db/models';
import { calculateScore } from './scoring';

/**
 * Differential verification for the scoring model.
 *
 * This file does not import or call any helper from scoring.ts other than
 * calculateScore itself (the function under test). `oracleScore` below is a
 * second, independently-written implementation of the same specification,
 * built from plain loops and object counters instead of Set/filter/map, so
 * that a bug in one of scoring.ts's internal helpers (coverageFor,
 * strengthScore) has no way to also be present in the oracle by construction.
 * A generated case is only interesting if the two implementations disagree.
 *
 * Method: seeded pseudo-random generation over a bounded domain (mulberry32,
 * fixed seed below), differential comparison against the oracle for every
 * generated case, plus a permutation-invariance property and the exhaustive
 * small-domain sweep described in section "Exhaustive sweep" further down.
 * If this file ever fails, it prints the seed and the exact failing
 * evidence array so the case can be reproduced and pinned as a named test.
 */

const SEED = 0x5eed1e55;
const CASE_COUNT = 20_000;

// --- deterministic PRNG (mulberry32) -------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, options: readonly T[]): T {
  return options[Math.floor(rng() * options.length)];
}

// --- bounded generation domain --------------------------------------------
// Small alphabets deliberately: the interesting behavior (source dedup,
// segment dedup, direct+provenance interaction, relationship partitioning)
// only shows up when values repeat across generated items, so a wide-open
// random string would generate almost no repeats and defeat the point.

const SOURCE_IDS = ['s1', 's2', 's3', 's4'] as const;
const SEGMENT_IDS = ['seg-a', 'seg-b', null] as const;
const CLASSIFICATIONS = [
  'pain',
  'workaround',
  'feature_request',
  'willingness_to_pay',
  'objection',
  'positive_reaction',
  'current_solution',
  'other',
] as const;
const RELATIONSHIPS = ['supports', 'contradicts', 'neutral', undefined] as const;
const PROVENANCE_STATES = ['exact', 'normalized', 'unverified', undefined] as const;

type GeneratedEvidence = Pick<EvidenceSignal, 'sourceId' | 'segmentId' | 'classification' | 'isDirect'> &
  Partial<Pick<EvidenceSignal, 'relationship' | 'provenanceState'>>;

function generateEvidence(rng: () => number): GeneratedEvidence {
  return {
    sourceId: pick(rng, SOURCE_IDS),
    segmentId: pick(rng, SEGMENT_IDS),
    classification: pick(rng, CLASSIFICATIONS),
    isDirect: rng() < 0.5,
    relationship: pick(rng, RELATIONSHIPS),
    provenanceState: pick(rng, PROVENANCE_STATES),
  };
}

function generateCase(rng: () => number): GeneratedEvidence[] {
  const size = Math.floor(rng() * 9); // 0..8 items
  return Array.from({ length: size }, () => generateEvidence(rng));
}

// --- independent oracle ----------------------------------------------------
// Re-derived from the scoring.ts specification using a different code shape
// (indexed for-loops and plain accumulator objects rather than Set/filter/
// map chains). Deliberately verbose so each rule is a separate, inspectable
// step rather than a one-line reduction that could hide the same mistake
// scoring.ts might make.

const BEHAVIORAL = { willingness_to_pay: true, workaround: true, current_solution: true } as Record<string, true>;

interface OracleCoverage {
  uniqueSources: number;
  uniqueSegments: number;
  directEvidenceCount: number;
  hasBehavioralEvidence: boolean;
}

function oracleCoverage(items: GeneratedEvidence[]): OracleCoverage {
  const seenSources: Record<string, true> = {};
  const seenSegments: Record<string, true> = {};
  let directCount = 0;
  let behavioral = false;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    seenSources[item.sourceId] = true;
    if (item.segmentId) seenSegments[item.segmentId] = true;
    if (item.isDirect === true && (item.provenanceState === 'exact' || item.provenanceState === 'normalized')) {
      directCount += 1;
    }
    if (BEHAVIORAL[item.classification]) behavioral = true;
  }

  return {
    uniqueSources: Object.keys(seenSources).length,
    uniqueSegments: Object.keys(seenSegments).length,
    directEvidenceCount: directCount,
    hasBehavioralEvidence: behavioral,
  };
}

function oracleStrength(items: GeneratedEvidence[], sourcePoints: number, sourceCap: number): number {
  const coverage = oracleCoverage(items);

  let sourceScore = coverage.uniqueSources * sourcePoints;
  if (sourceScore > sourceCap) sourceScore = sourceCap;

  let segmentScore = 0;
  if (coverage.uniqueSegments >= 2) segmentScore = 15;
  else if (coverage.uniqueSegments === 1) segmentScore = 5;

  const behaviorScore = coverage.hasBehavioralEvidence ? 15 : 0;

  let directnessScore = coverage.directEvidenceCount * 2;
  if (directnessScore > 10) directnessScore = 10;

  let total = sourceScore + segmentScore + behaviorScore + directnessScore;
  if (total > 100) total = 100;
  return total;
}

interface OracleResult {
  score: number;
  supportScore: number;
  counterEvidenceScore: number;
  status: string;
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  uniqueSourcesCount: number;
  uniqueSupportingSourcesCount: number;
  uniqueContradictingSourcesCount: number;
}

function oracleScore(items: GeneratedEvidence[]): OracleResult {
  const supporting: GeneratedEvidence[] = [];
  const contradicting: GeneratedEvidence[] = [];
  const neutral: GeneratedEvidence[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const rel = items[i].relationship;
    if (rel === 'supports') supporting.push(items[i]);
    else if (rel === 'contradicts') contradicting.push(items[i]);
    else neutral.push(items[i]);
  }

  const supportScore = oracleStrength(supporting, 15, 60);
  const counterEvidenceScore = oracleStrength(contradicting, 20, 60);

  let status: string;
  if (supporting.length > 0 && contradicting.length > 0) status = 'mixed';
  else if (contradicting.length > 0) status = 'contradicted';
  else if (supportScore >= 75) status = 'strongly-supported';
  else if (supportScore >= 30) status = 'moderately-supported';
  else if (supportScore > 0) status = 'weak-evidence';
  else status = 'unvalidated';

  return {
    score: supportScore,
    supportScore,
    counterEvidenceScore,
    status,
    supportingCount: supporting.length,
    contradictingCount: contradicting.length,
    neutralCount: neutral.length,
    uniqueSourcesCount: oracleCoverage(items).uniqueSources,
    uniqueSupportingSourcesCount: oracleCoverage(supporting).uniqueSources,
    uniqueContradictingSourcesCount: oracleCoverage(contradicting).uniqueSources,
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe('scoring: seeded differential verification against an independent oracle', () => {
  it(`agrees with the oracle across ${CASE_COUNT} seeded cases (seed 0x${SEED.toString(16)})`, () => {
    const rng = mulberry32(SEED);
    let checked = 0;

    for (let i = 0; i < CASE_COUNT; i += 1) {
      const evidence = generateCase(rng);
      const actual = calculateScore(evidence);
      const expected = oracleScore(evidence);

      if (
        actual.score !== expected.score ||
        actual.supportScore !== expected.supportScore ||
        actual.counterEvidenceScore !== expected.counterEvidenceScore ||
        actual.status !== expected.status ||
        actual.supportingCount !== expected.supportingCount ||
        actual.contradictingCount !== expected.contradictingCount ||
        actual.neutralCount !== expected.neutralCount ||
        actual.uniqueSourcesCount !== expected.uniqueSourcesCount ||
        actual.uniqueSupportingSourcesCount !== expected.uniqueSupportingSourcesCount ||
        actual.uniqueContradictingSourcesCount !== expected.uniqueContradictingSourcesCount
      ) {
        throw new Error(
          `Divergence at case ${i} (seed 0x${SEED.toString(16)}):\n` +
          `  evidence = ${JSON.stringify(evidence)}\n` +
          `  actual   = ${JSON.stringify(actual)}\n` +
          `  expected = ${JSON.stringify(expected)}`,
        );
      }
      checked += 1;
    }

    expect(checked).toBe(CASE_COUNT);
  });

  it('scores are permutation-invariant: reordering evidence never changes the result', () => {
    const rng = mulberry32(SEED ^ 0x9e3779b9);

    for (let i = 0; i < 2_000; i += 1) {
      const evidence = generateCase(rng);
      const reordered = shuffled(evidence, rng);

      const original = calculateScore(evidence);
      const afterShuffle = calculateScore(reordered);

      expect(afterShuffle).toEqual(original);
    }
  });
});

describe('scoring: exhaustive sweep over a bounded single-item domain', () => {
  // Every individual evidence item, one at a time, over the full cross
  // product of the smaller enums. This is small enough (2 sources that
  // collapse to 1 unique x 3 segments x 8 classifications x 2 isDirect x
  // 4 relationships x 4 provenance states = 1,536) to enumerate exactly
  // rather than sample, so it is a genuine boundary sweep, not a guess.
  it('agrees with the oracle for every single-item combination', () => {
    let total = 0;
    for (const sourceId of SOURCE_IDS.slice(0, 2)) {
      for (const segmentId of SEGMENT_IDS) {
        for (const classification of CLASSIFICATIONS) {
          for (const isDirect of [true, false]) {
            for (const relationship of RELATIONSHIPS) {
              for (const provenanceState of PROVENANCE_STATES) {
                const evidence: GeneratedEvidence[] = [
                  { sourceId, segmentId, classification, isDirect, relationship, provenanceState },
                ];
                const actual = calculateScore(evidence);
                const expected = oracleScore(evidence);
                expect(actual.score).toBe(expected.score);
                expect(actual.status).toBe(expected.status);
                expect(actual.supportScore).toBe(expected.supportScore);
                expect(actual.counterEvidenceScore).toBe(expected.counterEvidenceScore);
                total += 1;
              }
            }
          }
        }
      }
    }
    expect(total).toBe(2 * 3 * 8 * 2 * 4 * 4);
  });
});
