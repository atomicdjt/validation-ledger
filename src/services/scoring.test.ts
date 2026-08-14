import { describe, expect, it } from 'vitest';
import type { EvidenceSignal } from '../db/models';
import { calculateScore } from './scoring';

type TestEvidence = Pick<EvidenceSignal, 'sourceId' | 'segmentId' | 'classification' | 'isDirect'> &
  Partial<Pick<EvidenceSignal, 'relationship' | 'provenanceState'>>;

function signal(overrides: Partial<TestEvidence> = {}): TestEvidence {
  return {
    sourceId: 'source-1',
    segmentId: null,
    classification: 'pain',
    isDirect: false,
    relationship: 'supports',
    provenanceState: 'exact',
    ...overrides,
  };
}

describe('hypothesis scoring semantics', () => {
  it('classifies an empty evidence body as unvalidated', () => {
    expect(calculateScore([])).toMatchObject({
      score: 0,
      supportScore: 0,
      counterEvidenceScore: 0,
      status: 'unvalidated',
      supportingCount: 0,
      contradictingCount: 0,
      neutralCount: 0,
    });
  });

  it('treats a missing relationship as neutral rather than support', () => {
    const result = calculateScore([signal({ relationship: undefined, isDirect: true })]);
    expect(result).toMatchObject({
      score: 0,
      supportScore: 0,
      supportingCount: 0,
      neutralCount: 1,
      status: 'unvalidated',
    });
  });

  it('treats missing provenance as unverified for directness scoring', () => {
    const result = calculateScore([signal({ isDirect: true, provenanceState: undefined })]);
    expect(result.supportCoverage.directEvidenceCount).toBe(0);
    expect(result.supportScore).toBe(15);
  });

  it('classifies a single support signal as weak evidence', () => {
    expect(calculateScore([signal()])).toMatchObject({
      score: 15,
      supportScore: 15,
      status: 'weak-evidence',
    });
  });

  it('does not double-count duplicate support from one source', () => {
    const result = calculateScore([signal(), signal()]);
    expect(result.supportScore).toBe(15);
    expect(result.uniqueSupportingSourcesCount).toBe(1);
  });

  it('rewards support from independent sources', () => {
    const result = calculateScore([signal(), signal({ sourceId: 'source-2' })]);
    expect(result.supportScore).toBe(30);
    expect(result.status).toBe('moderately-supported');
  });

  it('awards segment diversity only from supporting evidence', () => {
    const result = calculateScore([
      signal({ segmentId: 'segment-1' }),
      signal({ sourceId: 'source-2', segmentId: 'segment-2' }),
      signal({ sourceId: 'counter', segmentId: 'segment-3', relationship: 'contradicts' }),
    ]);
    expect(result.supportCoverage.uniqueSegments).toBe(2);
    expect(result.supportScore).toBe(45);
  });

  it('classifies contradiction-only evidence as contradicted', () => {
    const result = calculateScore([signal({ relationship: 'contradicts' })]);
    expect(result).toMatchObject({
      score: 0,
      supportScore: 0,
      contradictingCount: 1,
      status: 'contradicted',
    });
    expect(result.counterEvidenceScore).toBeGreaterThan(0);
  });

  it('does not award willingness-to-pay support for contradictory evidence', () => {
    const result = calculateScore([
      signal({ relationship: 'contradicts', classification: 'willingness_to_pay', isDirect: true }),
    ]);
    expect(result.supportScore).toBe(0);
    expect(result.supportCoverage.hasBehavioralEvidence).toBe(false);
    expect(result.counterEvidenceCoverage.hasBehavioralEvidence).toBe(true);
  });

  it('does not award direct-evidence support for direct counterevidence', () => {
    const result = calculateScore([signal({ relationship: 'contradicts', isDirect: true })]);
    expect(result.supportCoverage.directEvidenceCount).toBe(0);
    expect(result.counterEvidenceCoverage.directEvidenceCount).toBe(1);
    expect(result.supportScore).toBe(0);
  });

  it('classifies mixed support and contradiction as mixed evidence', () => {
    const result = calculateScore([
      signal({ sourceId: 'support-1' }),
      signal({ sourceId: 'counter-1', relationship: 'contradicts' }),
    ]);
    expect(result.status).toBe('mixed');
    expect(result.supportScore).toBeGreaterThan(0);
    expect(result.counterEvidenceScore).toBeGreaterThan(0);
  });

  it('keeps neutral-only evidence outside support and counterevidence', () => {
    const result = calculateScore([signal({ relationship: 'neutral', isDirect: true })]);
    expect(result.supportScore).toBe(0);
    expect(result.counterEvidenceScore).toBe(0);
    expect(result.evidenceQuality.directEvidenceCount).toBe(1);
  });

  it('counts multiple signals from one source once for source strength', () => {
    const result = calculateScore([
      signal({ sourceId: 'same', classification: 'pain' }),
      signal({ sourceId: 'same', classification: 'workaround', isDirect: true }),
      signal({ sourceId: 'same', classification: 'current_solution' }),
    ]);
    expect(result.uniqueSupportingSourcesCount).toBe(1);
    expect(result.supportScore).toBe(32);
  });

  it('classifies strong independent support as strongly supported', () => {
    const evidence = Array.from({ length: 4 }, (_, index) => signal({
      sourceId: `source-${index}`,
      segmentId: index % 2 === 0 ? 'segment-a' : 'segment-b',
      classification: index === 0 ? 'current_solution' : 'pain',
      isDirect: true,
    }));
    expect(calculateScore(evidence)).toMatchObject({
      score: 98,
      supportScore: 98,
      status: 'strongly-supported',
    });
  });

  it('classifies high support with credible counterevidence as mixed', () => {
    const result = calculateScore([
      ...Array.from({ length: 4 }, (_, index) => signal({
        sourceId: `support-${index}`,
        segmentId: index % 2 ? 'segment-a' : 'segment-b',
        isDirect: true,
      })),
      signal({ sourceId: 'counter-1', relationship: 'contradicts', isDirect: true }),
    ]);
    expect(result.supportScore).toBeGreaterThanOrEqual(75);
    expect(result.status).toBe('mixed');
  });

  it('keeps all score dimensions within zero and one hundred', () => {
    const result = calculateScore(Array.from({ length: 30 }, (_, index) => signal({
      sourceId: `source-${index}`,
      segmentId: `segment-${index}`,
      classification: 'willingness_to_pay',
      isDirect: true,
      relationship: index % 2 ? 'supports' : 'contradicts',
    })));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.supportScore).toBeLessThanOrEqual(100);
    expect(result.counterEvidenceScore).toBeLessThanOrEqual(100);
  });
});
