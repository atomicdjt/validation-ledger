import Dexie, { Table } from 'dexie';
import {
  Project,
  Segment,
  Source,
  EvidenceSignal,
  Hypothesis,
  Decision,
  EvidenceDecisionLink,
  HypothesisDecisionLink,
  Assumption,
  Alternative,
  Risk,
  Review,
  Revision
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
  
  assumptions!: Table<Assumption, string>;
  alternatives!: Table<Alternative, string>;
  risks!: Table<Risk, string>;
  reviews!: Table<Review, string>;
  revisions!: Table<Revision, string>;

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
    this.version(3).stores({
      projects: 'id, createdAt, updatedAt',
      segments: 'id, projectId, priority',
      sources: 'id, projectId, segmentId, date, type',
      evidenceSignals: 'id, projectId, sourceId, segmentId, hypothesisId, classification, confidence',
      hypotheses: 'id, projectId, category, importance, status, confidenceScore',
      decisions: 'id, projectId, createdAt, status',
      evidenceDecisionLinks: 'id, projectId, evidenceId, decisionId',
      hypothesisDecisionLinks: 'id, projectId, hypothesisId, decisionId'
    }).upgrade(async (transaction) => {
      await transaction.table('decisions').toCollection().modify((decision: Record<string, unknown>) => {
        decision.status = decision.status || 'accepted';
        decision.alternatives = decision.alternatives || '';
        decision.assumptions = decision.assumptions || '';
        decision.validationMethod = decision.validationMethod || '';
        decision.outcome = decision.outcome || '';
      });
    });
    this.version(4).stores({
      projects: 'id, createdAt, updatedAt',
      segments: 'id, projectId, priority',
      sources: 'id, projectId, segmentId, date, type',
      evidenceSignals: 'id, projectId, sourceId, segmentId, hypothesisId, classification, confidence',
      hypotheses: 'id, projectId, category, importance, status, confidenceScore',
      decisions: 'id, projectId, createdAt, status',
      evidenceDecisionLinks: 'id, projectId, evidenceId, decisionId',
      hypothesisDecisionLinks: 'id, projectId, hypothesisId, decisionId',
      assumptions: 'id, projectId, decisionId',
      alternatives: 'id, projectId, decisionId',
      risks: 'id, projectId, decisionId',
      reviews: 'id, projectId, decisionId',
      revisions: 'id, projectId, entityType, entityId'
    });
  }
}

export const db = new ValidationLedgerDatabase();
