import Dexie, { Table } from 'dexie';
import {
  Project,
  Segment,
  Source,
  EvidenceSignal,
  Hypothesis,
  Decision,
  EvidenceDecisionLink,
  HypothesisDecisionLink
} from './models';

export class ValidationLedgerDatabase extends Dexie {
  projects!: Table<Project, string>;
  segments!: Table<Segment, string>;
  sources!: Table<Source, string>;
  evidenceSignals!: Table<EvidenceSignal, string>;
  hypotheses!: Table<Hypothesis, string>;
  decisions!: Table<Decision, string>;
  evidenceDecisionLinks!: Table<EvidenceDecisionLink, string>;
  hypothesisDecisionLinks!: Table<HypothesisDecisionLink, string>;

  constructor() {
    super('ValidationLedgerDatabase');
    this.version(1).stores({
      projects: 'id, createdAt, updatedAt',
      segments: 'id, projectId, priority',
      sources: 'id, projectId, segmentId, date, type',
      evidenceSignals: 'id, projectId, sourceId, segmentId, hypothesisId, classification, confidence',
      hypotheses: 'id, projectId, category, importance, status, confidenceScore',
      decisions: 'id, projectId, createdAt',
      evidenceDecisionLinks: 'id, projectId, evidenceId, decisionId',
      hypothesisDecisionLinks: 'id, projectId, hypothesisId, decisionId'
    });
    this.version(2).stores({
      projects: 'id, createdAt, updatedAt',
      segments: 'id, projectId, priority',
      sources: 'id, projectId, segmentId, date, type',
      evidenceSignals: 'id, projectId, sourceId, segmentId, hypothesisId, classification, confidence',
      hypotheses: 'id, projectId, category, importance, status, confidenceScore',
      decisions: 'id, projectId, createdAt',
      evidenceDecisionLinks: 'id, projectId, evidenceId, decisionId',
      hypothesisDecisionLinks: 'id, projectId, hypothesisId, decisionId'
    }).upgrade(async (transaction) => {
      await transaction.table('evidenceSignals').toCollection().modify((evidence: Record<string, unknown>) => {
        if (!['supports', 'contradicts', 'neutral'].includes(String(evidence.relationship))) {
          evidence.relationship = 'neutral';
        }
        if (!['exact', 'normalized', 'unverified'].includes(String(evidence.provenanceState))) {
          evidence.provenanceState = 'unverified';
        }
      });
      await transaction.table('hypotheses').toCollection().modify((hypothesis: Record<string, unknown>) => {
        const legacyStatuses: Record<string, string> = {
          validating: 'weak-evidence',
          validated: 'strongly-supported',
          invalidated: 'contradicted',
        };
        hypothesis.status = legacyStatuses[String(hypothesis.status)] ?? hypothesis.status ?? 'unvalidated';
      });
    });
  }
}

export const db = new ValidationLedgerDatabase();
