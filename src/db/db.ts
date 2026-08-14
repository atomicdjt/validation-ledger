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
  }
}

export const db = new ValidationLedgerDatabase();
