import { db } from './db';
import type {
  Decision,
  EvidenceDecisionLink,
  EvidenceSignal,
  Hypothesis,
  HypothesisDecisionLink,
  Project,
  Segment,
  Source,
} from './models';

interface DatabaseExport {
  formatVersion: 1;
  exportedAt: string;
  projects: Project[];
  segments: Segment[];
  sources: Source[];
  evidenceSignals: EvidenceSignal[];
  hypotheses: Hypothesis[];
  decisions: Decision[];
  evidenceDecisionLinks: EvidenceDecisionLink[];
  hypothesisDecisionLinks: HypothesisDecisionLink[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireArray(data: Record<string, unknown>, key: string): unknown[] {
  const value = data[key];
  if (!Array.isArray(value)) throw new Error(`Invalid backup: “${key}” must be an array.`);
  return value;
}

function validateRows(rows: unknown[], table: string, requiredFields: string[]): void {
  rows.forEach((row, index) => {
    if (!isRecord(row) || requiredFields.some((field) => typeof row[field] !== 'string' || !row[field])) {
      throw new Error(`Invalid backup: ${table}[${index}] is missing required fields.`);
    }
  });
}

export async function exportDatabase(): Promise<string> {
  const data: DatabaseExport = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    projects: await db.projects.toArray(),
    segments: await db.segments.toArray(),
    sources: await db.sources.toArray(),
    evidenceSignals: await db.evidenceSignals.toArray(),
    hypotheses: await db.hypotheses.toArray(),
    decisions: await db.decisions.toArray(),
    evidenceDecisionLinks: await db.evidenceDecisionLinks.toArray(),
    hypothesisDecisionLinks: await db.hypothesisDecisionLinks.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid backup: the file is not valid JSON.');
  }

  if (!isRecord(parsed)) throw new Error('Invalid backup: expected a JSON object.');
  if (parsed.formatVersion !== undefined && parsed.formatVersion !== 1) {
    throw new Error(`Unsupported backup format version: ${String(parsed.formatVersion)}.`);
  }

  const projects = requireArray(parsed, 'projects');
  const segments = requireArray(parsed, 'segments');
  const sources = requireArray(parsed, 'sources');
  const evidenceSignals = requireArray(parsed, 'evidenceSignals');
  const hypotheses = requireArray(parsed, 'hypotheses');
  const decisions = requireArray(parsed, 'decisions');
  const evidenceDecisionLinks = parsed.evidenceDecisionLinks === undefined ? [] : requireArray(parsed, 'evidenceDecisionLinks');
  const hypothesisDecisionLinks = parsed.hypothesisDecisionLinks === undefined ? [] : requireArray(parsed, 'hypothesisDecisionLinks');

  validateRows(projects, 'projects', ['id', 'name']);
  validateRows(segments, 'segments', ['id', 'projectId', 'name']);
  validateRows(sources, 'sources', ['id', 'projectId', 'participantId']);
  validateRows(evidenceSignals, 'evidenceSignals', ['id', 'projectId', 'sourceId', 'statement']);
  validateRows(hypotheses, 'hypotheses', ['id', 'projectId', 'statement']);
  validateRows(decisions, 'decisions', ['id', 'projectId', 'title']);
  validateRows(evidenceDecisionLinks, 'evidenceDecisionLinks', ['id', 'projectId', 'evidenceId', 'decisionId']);
  validateRows(hypothesisDecisionLinks, 'hypothesisDecisionLinks', ['id', 'projectId', 'hypothesisId', 'decisionId']);

  await db.transaction(
    'rw',
    [
      db.projects,
      db.segments,
      db.sources,
      db.evidenceSignals,
      db.hypotheses,
      db.decisions,
      db.evidenceDecisionLinks,
      db.hypothesisDecisionLinks,
    ],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.segments.clear(),
        db.sources.clear(),
        db.evidenceSignals.clear(),
        db.hypotheses.clear(),
        db.decisions.clear(),
        db.evidenceDecisionLinks.clear(),
        db.hypothesisDecisionLinks.clear(),
      ]);
      await db.projects.bulkAdd(projects as Project[]);
      await db.segments.bulkAdd(segments as Segment[]);
      await db.sources.bulkAdd(sources as Source[]);
      await db.evidenceSignals.bulkAdd(evidenceSignals as EvidenceSignal[]);
      await db.hypotheses.bulkAdd(hypotheses as Hypothesis[]);
      await db.decisions.bulkAdd(decisions as Decision[]);
      await db.evidenceDecisionLinks.bulkAdd(evidenceDecisionLinks as EvidenceDecisionLink[]);
      await db.hypothesisDecisionLinks.bulkAdd(hypothesisDecisionLinks as HypothesisDecisionLink[]);
    },
  );

  return (projects[0] as Project | undefined)?.id ?? null;
}
