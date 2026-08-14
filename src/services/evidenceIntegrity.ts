import type {
  EvidenceClassification,
  EvidenceSignal,
  EvidenceRelationship,
  Hypothesis,
  ProvenanceState,
} from '../db/models';
import type { ExtractedEvidence } from './ai';
import { generateId } from '../utils/id';
import type { Source } from '../db/models';

export const EVIDENCE_CLASSIFICATIONS: readonly EvidenceClassification[] = [
  'pain',
  'workaround',
  'feature_request',
  'willingness_to_pay',
  'objection',
  'positive_reaction',
  'current_solution',
  'other',
];

export const EVIDENCE_RELATIONSHIPS: readonly EvidenceRelationship[] = [
  'supports',
  'contradicts',
  'neutral',
];

export interface ProvenanceVerification {
  state: ProvenanceState;
  matchedExcerpt: string | null;
}

export interface StagedEvidenceSuggestion {
  tempId: string;
  reviewState: 'pending' | 'rejected';
  classification: EvidenceClassification;
  statement: string;
  exactExcerpt: string;
  isDirect: boolean;
  hypothesisId: string | null;
  relationship: EvidenceRelationship;
  confidence: number;
  provenance: ProvenanceVerification;
  warnings: string[];
  selected: boolean;
}

interface NormalizedText {
  value: string;
  starts: number[];
  ends: number[];
}

function normalizeCharacter(character: string): string {
  if ('“”„‟'.includes(character)) return '"';
  if ('‘’‚‛'.includes(character)) return "'";
  if (character === '\u00a0') return ' ';
  return character;
}

function normalizeWithOffsets(input: string): NormalizedText {
  let value = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let whitespaceOpen = false;

  for (let index = 0; index < input.length; index += 1) {
    const normalized = normalizeCharacter(input[index]);
    if (/\s/.test(normalized)) {
      if (!whitespaceOpen) {
        value += ' ';
        starts.push(index);
        ends.push(index + 1);
        whitespaceOpen = true;
      } else {
        ends[ends.length - 1] = index + 1;
      }
      continue;
    }
    whitespaceOpen = false;
    value += normalized;
    starts.push(index);
    ends.push(index + 1);
  }

  return { value, starts, ends };
}

export function verifyExcerptProvenance(sourceText: string, claimedExcerpt: string): ProvenanceVerification {
  if (!claimedExcerpt) return { state: 'unverified', matchedExcerpt: null };
  const exactIndex = sourceText.indexOf(claimedExcerpt);
  if (exactIndex >= 0) {
    return { state: 'exact', matchedExcerpt: sourceText.slice(exactIndex, exactIndex + claimedExcerpt.length) };
  }

  const normalizedSource = normalizeWithOffsets(sourceText);
  const normalizedExcerpt = normalizeWithOffsets(claimedExcerpt).value;
  if (!normalizedExcerpt.trim()) return { state: 'unverified', matchedExcerpt: null };
  const normalizedIndex = normalizedSource.value.indexOf(normalizedExcerpt);
  if (normalizedIndex < 0) return { state: 'unverified', matchedExcerpt: null };

  const start = normalizedSource.starts[normalizedIndex];
  const end = normalizedSource.ends[normalizedIndex + normalizedExcerpt.length - 1];
  return {
    state: 'normalized',
    matchedExcerpt: sourceText.slice(start, end),
  };
}

function validClassification(value: string): EvidenceClassification {
  return EVIDENCE_CLASSIFICATIONS.includes(value as EvidenceClassification)
    ? value as EvidenceClassification
    : 'other';
}

function validRelationship(value: unknown): EvidenceRelationship {
  return EVIDENCE_RELATIONSHIPS.includes(value as EvidenceRelationship)
    ? value as EvidenceRelationship
    : 'neutral';
}

export function prepareEvidenceSuggestions(
  extracted: ExtractedEvidence[],
  sourceText: string,
  hypotheses: Hypothesis[],
  projectId: string,
): StagedEvidenceSuggestion[] {
  const validHypotheses = new Set(
    hypotheses.filter((hypothesis) => hypothesis.projectId === projectId).map((hypothesis) => hypothesis.id),
  );

  return extracted.map((item) => {
    const warnings: string[] = [];
    const hypothesisId = item.hypothesisId && validHypotheses.has(item.hypothesisId)
      ? item.hypothesisId
      : null;
    if (item.hypothesisId && !hypothesisId) {
      warnings.push('The proposed hypothesis link was removed because it is not valid for this project.');
    }

    const relationship = hypothesisId ? validRelationship(item.relationship) : 'neutral';
    if (item.relationship && relationship !== item.relationship) {
      warnings.push('The proposed relationship was reset because it was not recognized.');
    }

    const provenance = verifyExcerptProvenance(sourceText, item.exactExcerpt);
    const isDirect = item.isDirect && provenance.state !== 'unverified';
    if (provenance.state === 'unverified') {
      warnings.push('The claimed quote was not found in the source. It can only be accepted as an inference unless corrected.');
    } else if (provenance.state === 'normalized') {
      warnings.push('The quote matched after conservative whitespace or quotation-mark normalization.');
    }

    return {
      tempId: generateId(),
      reviewState: 'pending',
      classification: validClassification(item.classification),
      statement: item.statement.trim(),
      exactExcerpt: provenance.matchedExcerpt ?? item.exactExcerpt.trim(),
      isDirect,
      hypothesisId,
      relationship,
      confidence: 5,
      provenance,
      warnings,
      selected: true,
    };
  });
}

export function acceptedSuggestionsToEvidence(
  suggestions: StagedEvidenceSuggestion[],
  source: Source,
): EvidenceSignal[] {
  return suggestions
    .filter((suggestion) => suggestion.selected && suggestion.reviewState === 'pending')
    .map((suggestion) => ({
      id: generateId(),
      projectId: source.projectId,
      sourceId: source.id,
      segmentId: source.segmentId,
      hypothesisId: suggestion.hypothesisId,
      relationship: suggestion.hypothesisId ? suggestion.relationship : 'neutral',
      classification: suggestion.classification,
      statement: suggestion.statement,
      exactExcerpt: suggestion.exactExcerpt,
      isDirect: suggestion.isDirect && suggestion.provenance.state !== 'unverified',
      confidence: suggestion.confidence,
      notes: '',
      createdAt: Date.now(),
      provenanceState: suggestion.provenance.state,
    }));
}
