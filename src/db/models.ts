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
  metadata: Record<string, any>;
  tags: string[];
}

export interface EvidenceSignal {
  id: string;
  projectId: string;
  sourceId: string;
  segmentId: string | null;
  hypothesisId: string | null;
  relationship?: 'supports' | 'contradicts' | 'neutral';
  classification: string;
  statement: string;
  exactExcerpt: string;
  isDirect: boolean;
  confidence: number;
  quantitativeValue?: number;
  notes: string;
  createdAt: number;
}

export interface Hypothesis {
  id: string;
  projectId: string;
  statement: string;
  category: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  status: 'unvalidated' | 'validating' | 'validated' | 'invalidated';
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
  createdAt: number;
  reviewDate?: number;
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
