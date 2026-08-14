import { describe, expect, it } from 'vitest';
import type { EvidenceSignal } from '../db/models';
import { calculateScore } from './scoring';

type TestEvidence = Pick<EvidenceSignal, 'sourceId' | 'segmentId' | 'classification' | 'isDirect'> &
  Partial<Pick<EvidenceSignal, 'relationship'>>;

function signal(overrides: Partial<TestEvidence> = {}): TestEvidence {
  return {
    sourceId: 'source-1',
    segmentId: null,
    classification: 'pain',
    isDirect: false,
    relationship: 'supports',
    ...overrides,
  };
}

describe('Validation Scoring Engine', () => {
  it('returns an unvalidated zero score when there is no evidence', () => {
    const result = calculateScore([]);
    expect(result).toMatchObject({
      score: 0,
      status: 'unvalidated',
      supportingCount: 0,
      contradictingCount: 0,
      uniqueSourcesCount: 0,
    });
    expect(result.reasons).toContain('No evidence gathered yet.');
  });

  it('counts unique supporting sources instead of duplicate signals', () => {
    const result = calculateScore([
      signal({ sourceId: 'source-1', isDirect: true }),
      signal({ sourceId: 'source-1', isDirect: true }),
      signal({ sourceId: 'source-2' }),
    ]);

    expect(result.score).toBe(34); // 30 unique-source points + 4 directness points
    expect(result.uniqueSourcesCount).toBe(2);
    expect(result.supportingCount).toBe(3);
    expect(result.status).toBe('validating');
  });

  it('awards the exact diversity, behavioral, and directness bonuses', () => {
    const result = calculateScore([
      signal({ sourceId: 'source-1', segmentId: 'segment-1', classification: 'willingness_to_pay', isDirect: true }),
      signal({ sourceId: 'source-2', segmentId: 'segment-2', classification: 'current_solution', isDirect: true }),
    ]);

    expect(result.score).toBe(64); // 30 support + 15 diversity + 15 behavior + 4 directness
    expect(result.status).toBe('validating');
    expect(result.hasBehavioralEvidence).toBe(true);
  });

  it('caps a strong body of evidence at 100 and marks it validated', () => {
    const result = calculateScore(
      Array.from({ length: 5 }, (_, index) => signal({
        sourceId: `source-${index}`,
        segmentId: index % 2 === 0 ? 'segment-1' : 'segment-2',
        classification: index === 0 ? 'workaround' : 'pain',
        isDirect: true,
      })),
    );

    expect(result.score).toBe(100);
    expect(result.status).toBe('validated');
  });

  it('invalidates a weak hypothesis contradicted by two independent sources', () => {
    const result = calculateScore([
      signal({ sourceId: 'source-1', relationship: 'contradicts', isDirect: true }),
      signal({ sourceId: 'source-2', relationship: 'contradicts', isDirect: true }),
    ]);

    expect(result.score).toBe(0);
    expect(result.contradictingCount).toBe(2);
    expect(result.status).toBe('invalidated');
  });

  it('tracks neutral evidence without treating it as support', () => {
    const result = calculateScore([signal({ relationship: 'neutral', isDirect: true })]);

    expect(result.score).toBe(2);
    expect(result.neutralCount).toBe(1);
    expect(result.supportingCount).toBe(0);
    expect(result.status).toBe('unvalidated');
  });
});
