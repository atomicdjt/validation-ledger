export interface Project {
  id: string;
  name: string;
  productDescription: string;
  validationObjective: string;
  stage: string;
  createdAt: number;
  updatedAt: number;
}

export interface Segment {
  id: string;
  projectId: string;
  name: string;
  description: string;
  characteristics: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Source {
  id: string;
  projectId: string;
  participantId: string;
  segmentId: string | null;
  date: number;
  type: 'interview' | 'email' | 'survey' | 'sales_call' | 'support' | 'observation' | 'other';
  rawText: string;
  metadata: Record<string, string | number | boolean | null | string[] | number[] | boolean[]>;
  tags: string[];
}

export interface EvidenceSignal {
  id: string;
  projectId: string;
  sourceId: string;
  segmentId: string | null;
  hypothesisId: string | null;
  relationship: 'supports' | 'contradicts' | 'neutral';
  classification: EvidenceClassification;
  statement: string;
  exactExcerpt: string;
  isDirect: boolean;
  confidence: number;
  quantitativeValue?: number;
  notes: string;
  createdAt: number;
  provenanceState: ProvenanceState;
  validityState?: 'active' | 'superseded' | 'disputed' | 'withdrawn' | 'contradicted' | 'outdated' | 'unverifiable';
}

export type EvidenceRelationship = EvidenceSignal['relationship'];
export type ProvenanceState = 'exact' | 'normalized' | 'unverified';
export type EvidenceClassification =
  | 'pain'
  | 'workaround'
  | 'feature_request'
  | 'willingness_to_pay'
  | 'objection'
  | 'positive_reaction'
  | 'current_solution'
  | 'other';

export interface Hypothesis {
  id: string;
  projectId: string;
  statement: string;
  category: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  status:
    | 'unvalidated'
    | 'weak-evidence'
    | 'mixed'
    | 'moderately-supported'
    | 'strongly-supported'
    | 'contradicted';
  confidenceScore: number;
  createdAt: number;
  lastReviewed?: number;
}

export interface Decision {
  id: string;
  projectId: string;
  title: string;
  description: string;
  reason: string;
  confidence: 'low' | 'moderate' | 'high';
  status: 'proposed' | 'accepted' | 'rejected' | 'reverted' | 'validated';
  // Legacy fields, keeping them for backward compatibility, but we will use the new entities
  alternatives: string;
  assumptions: string;
  validationMethod: string;
  outcome: string;
  createdAt: number;
  reviewDate?: number;
  integrityHash?: string;
  needsAttention?: boolean;
}

export interface EvidenceDecisionLink {
  id: string;
  projectId: string;
  evidenceId: string;
  decisionId: string;
}

export interface HypothesisDecisionLink {
  id: string;
  projectId: string;
  hypothesisId: string;
  decisionId: string;
}

export interface Assumption {
  id: string;
  projectId: string;
  decisionId: string;
  statement: string;
  status: 'unresolved' | 'validated' | 'invalidated';
}

export interface Alternative {
  id: string;
  projectId: string;
  decisionId: string;
  title: string;
  description: string;
  status: 'considered' | 'rejected' | 'selected';
}

export interface Risk {
  id: string;
  projectId: string;
  decisionId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'unassessed' | 'mitigated' | 'accepted';
}

export interface Review {
  id: string;
  projectId: string;
  decisionId: string;
  reviewer: string;
  status: 'requested' | 'approved' | 'approved_with_reservations' | 'rejected' | 'needs_revision';
  comments: string;
  date: number;
}

export interface Revision {
  id: string;
  projectId: string;
  entityType: 'decision' | 'evidence' | 'hypothesis' | 'assumption' | 'alternative' | 'risk' | 'review';
  entityId: string;
  timestamp: number;
  actor: string;
  previousState: string;
  newState: string;
  reason: string;
  hash: string;
  previousHash: string;
}
