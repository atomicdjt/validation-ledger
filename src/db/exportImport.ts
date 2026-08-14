import { db } from './db';
import type { Decision, EvidenceDecisionLink, EvidenceSignal, Hypothesis, HypothesisDecisionLink, Project, Segment, Source } from './models';
import { EVIDENCE_CLASSIFICATIONS, EVIDENCE_RELATIONSHIPS } from '../services/evidenceIntegrity';
import { verifyExcerptProvenance } from '../services/evidenceIntegrity';
import { calculateScore } from '../services/scoring';

export const BACKUP_FORMAT_VERSION = 2;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_RECORDS = 100_000;
export const MAX_RECORDS_PER_TABLE = 50_000;

export interface DatabaseExport {
  formatVersion: 2;
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

type Row = Record<string, unknown>;
const TABLES = ['projects', 'segments', 'sources', 'evidenceSignals', 'hypotheses', 'decisions', 'evidenceDecisionLinks', 'hypothesisDecisionLinks'] as const;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function fail(message: string): never { throw new Error(`Invalid backup: ${message}`); }
function isRow(value: unknown): value is Row { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function text(row: Row, key: string, path: string, allowEmpty = true): string {
  const value = row[key];
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail(`${path}.${key} must be a ${allowEmpty ? 'string' : 'non-empty string'}.`);
  return value as string;
}
function nullableText(row: Row, key: string, path: string): string | null {
  const value = row[key];
  if (value !== null && typeof value !== 'string') fail(`${path}.${key} must be a string or null.`);
  return value as string | null;
}
function number(row: Row, key: string, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${path}.${key} must be a finite number between ${min} and ${max}.`);
  return value as number;
}
function optionalNumber(row: Row, key: string, path: string): number | undefined {
  if (row[key] === undefined) return undefined;
  return number(row, key, path, Number.MIN_SAFE_INTEGER);
}
function boolean(row: Row, key: string, path: string): boolean {
  if (typeof row[key] !== 'boolean') fail(`${path}.${key} must be a boolean.`);
  return row[key] as boolean;
}
function enumValue<T extends string>(row: Row, key: string, path: string, allowed: readonly T[]): T {
  const value = text(row, key, path);
  if (!allowed.includes(value as T)) fail(`${path}.${key} has an unsupported value.`);
  return value as T;
}
function stringArray(row: Row, key: string, path: string): string[] {
  const value = row[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) fail(`${path}.${key} must be an array of strings.`);
  return value as string[];
}
function safeJson(value: unknown, path: string, depth = 0): void {
  if (depth > 20) fail(`${path} is nested too deeply.`);
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach((item, index) => safeJson(item, `${path}[${index}]`, depth + 1)); return; }
  if (!isRow(value)) fail(`${path} must contain only JSON-safe values.`);
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) fail(`${path} contains a forbidden key.`);
    safeJson(value[key], `${path}.${key}`, depth + 1);
  }
}
function rows(data: Row, key: typeof TABLES[number]): Row[] {
  const value = data[key];
  if (!Array.isArray(value)) fail(`${key} must be an array.`);
  if (value.length > MAX_RECORDS_PER_TABLE) fail(`${key} exceeds the ${MAX_RECORDS_PER_TABLE.toLocaleString()} record limit.`);
  value.forEach((item, index) => { if (!isRow(item)) fail(`${key}[${index}] must be an object.`); });
  const ids = new Set<string>();
  value.forEach((item, index) => { const id = text(item as Row, 'id', `${key}[${index}]`, false); if (ids.has(id)) fail(`${key} contains duplicate id "${id}".`); ids.add(id); });
  return value as Row[];
}

function validateBackup(data: Row): DatabaseExport {
  if (data.formatVersion !== 1 && data.formatVersion !== BACKUP_FORMAT_VERSION) fail(`unsupported format version ${String(data.formatVersion)}.`);
  if (typeof data.exportedAt !== 'string' || Number.isNaN(Date.parse(data.exportedAt))) fail('exportedAt must be a valid ISO date string.');
  const tableRows = Object.fromEntries(TABLES.map((table) => [table, rows(data, table)])) as Record<typeof TABLES[number], Row[]>;
  const total = TABLES.reduce((sum, table) => sum + tableRows[table].length, 0);
  if (total > MAX_TOTAL_RECORDS) fail(`record count exceeds the ${MAX_TOTAL_RECORDS.toLocaleString()} total limit.`);

  const projects = tableRows.projects.map((r, i): Project => ({ id: text(r,'id',`projects[${i}]`,false), name: text(r,'name',`projects[${i}]`,false), productDescription: text(r,'productDescription',`projects[${i}]`), validationObjective: text(r,'validationObjective',`projects[${i}]`), stage: text(r,'stage',`projects[${i}]`), createdAt: number(r,'createdAt',`projects[${i}]`), updatedAt: number(r,'updatedAt',`projects[${i}]`) }));
  const segments = tableRows.segments.map((r, i): Segment => ({ id:text(r,'id',`segments[${i}]`,false), projectId:text(r,'projectId',`segments[${i}]`,false), name:text(r,'name',`segments[${i}]`,false), description:text(r,'description',`segments[${i}]`), characteristics:stringArray(r,'characteristics',`segments[${i}]`), priority:enumValue(r,'priority',`segments[${i}]`,['low','medium','high','critical']) }));
  const sources = tableRows.sources.map((r, i): Source => { const path=`sources[${i}]`; const rawText=text(r,'rawText',path); if (new TextEncoder().encode(rawText).byteLength > MAX_SOURCE_TEXT_BYTES) fail(`${path}.rawText exceeds the 2 MB limit.`); if (!isRow(r.metadata)) fail(`${path}.metadata must be an object.`); safeJson(r.metadata,`${path}.metadata`); return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), participantId:text(r,'participantId',path,false), segmentId:nullableText(r,'segmentId',path), date:number(r,'date',path), type:enumValue(r,'type',path,['interview','email','survey','sales_call','support','observation','other']), rawText, metadata:r.metadata, tags:stringArray(r,'tags',path) }; });
  const statuses = ['unvalidated','weak-evidence','mixed','moderately-supported','strongly-supported','contradicted'] as const;
  const hypotheses = tableRows.hypotheses.map((r, i): Hypothesis => { const path=`hypotheses[${i}]`; let status=String(r.status); if (data.formatVersion===1) status=({validating:'weak-evidence',validated:'strongly-supported',invalidated:'contradicted'} as Record<string,string>)[status] ?? status; if (!statuses.includes(status as typeof statuses[number])) fail(`${path}.status has an unsupported value.`); return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), statement:text(r,'statement',path,false), category:text(r,'category',path), importance:enumValue(r,'importance',path,['low','medium','high','critical']), status:status as Hypothesis['status'], confidenceScore:number(r,'confidenceScore',path,0,100), createdAt:number(r,'createdAt',path), lastReviewed:optionalNumber(r,'lastReviewed',path) }; });
  const evidenceSignals = tableRows.evidenceSignals.map((r, i): EvidenceSignal => { const path=`evidenceSignals[${i}]`; const relationship=data.formatVersion===1 && r.relationship===undefined ? 'neutral' : enumValue(r,'relationship',path,EVIDENCE_RELATIONSHIPS); const provenanceState=data.formatVersion===1 && r.provenanceState===undefined ? 'unverified' : enumValue(r,'provenanceState',path,['exact','normalized','unverified']); return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), sourceId:text(r,'sourceId',path,false), segmentId:nullableText(r,'segmentId',path), hypothesisId:nullableText(r,'hypothesisId',path), relationship, classification:enumValue(r,'classification',path,EVIDENCE_CLASSIFICATIONS), statement:text(r,'statement',path,false), exactExcerpt:text(r,'exactExcerpt',path), isDirect:boolean(r,'isDirect',path), confidence:number(r,'confidence',path,0,10), quantitativeValue:optionalNumber(r,'quantitativeValue',path), notes:text(r,'notes',path), createdAt:number(r,'createdAt',path), provenanceState }; });
  const decisions = tableRows.decisions.map((r, i): Decision => { const path=`decisions[${i}]`; return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), title:text(r,'title',path,false), description:text(r,'description',path), reason:text(r,'reason',path), confidence:enumValue(r,'confidence',path,['low','moderate','high']), createdAt:number(r,'createdAt',path), reviewDate:optionalNumber(r,'reviewDate',path) }; });
  const evidenceDecisionLinks = tableRows.evidenceDecisionLinks.map((r,i):EvidenceDecisionLink => { const path=`evidenceDecisionLinks[${i}]`; return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), evidenceId:text(r,'evidenceId',path,false), decisionId:text(r,'decisionId',path,false) }; });
  const hypothesisDecisionLinks = tableRows.hypothesisDecisionLinks.map((r,i):HypothesisDecisionLink => { const path=`hypothesisDecisionLinks[${i}]`; return { id:text(r,'id',path,false), projectId:text(r,'projectId',path,false), hypothesisId:text(r,'hypothesisId',path,false), decisionId:text(r,'decisionId',path,false) }; });

  const projectMap=new Map(projects.map(x=>[x.id,x])); const segmentMap=new Map(segments.map(x=>[x.id,x])); const sourceMap=new Map(sources.map(x=>[x.id,x])); const hypothesisMap=new Map(hypotheses.map(x=>[x.id,x])); const evidenceMap=new Map(evidenceSignals.map(x=>[x.id,x])); const decisionMap=new Map(decisions.map(x=>[x.id,x]));
  segments.forEach(x=>{if(!projectMap.has(x.projectId)) fail(`segment "${x.id}" references a missing project.`);});
  sources.forEach(x=>{if(!projectMap.has(x.projectId)) fail(`source "${x.id}" references a missing project.`); if(x.segmentId && segmentMap.get(x.segmentId)?.projectId!==x.projectId) fail(`source "${x.id}" has an invalid or cross-project segment.`);});
  hypotheses.forEach(x=>{if(!projectMap.has(x.projectId)) fail(`hypothesis "${x.id}" references a missing project.`);});
  decisions.forEach(x=>{if(!projectMap.has(x.projectId)) fail(`decision "${x.id}" references a missing project.`);});
  evidenceSignals.forEach(x=>{const s=sourceMap.get(x.sourceId); if(!s || s.projectId!==x.projectId) fail(`evidence "${x.id}" has an invalid or cross-project source.`); if(x.segmentId!==s.segmentId) fail(`evidence "${x.id}" segment must match its source.`); if(x.segmentId && segmentMap.get(x.segmentId)?.projectId!==x.projectId) fail(`evidence "${x.id}" has an invalid or cross-project segment.`); if(x.hypothesisId && hypothesisMap.get(x.hypothesisId)?.projectId!==x.projectId) fail(`evidence "${x.id}" has an invalid or cross-project hypothesis.`); const provenance=verifyExcerptProvenance(s.rawText,x.exactExcerpt); x.provenanceState=provenance.state; x.exactExcerpt=provenance.matchedExcerpt ?? x.exactExcerpt; if(provenance.state==='unverified') x.isDirect=false;});
  evidenceDecisionLinks.forEach(x=>{if(evidenceMap.get(x.evidenceId)?.projectId!==x.projectId || decisionMap.get(x.decisionId)?.projectId!==x.projectId) fail(`evidence-decision link "${x.id}" is invalid or cross-project.`);});
  hypothesisDecisionLinks.forEach(x=>{if(hypothesisMap.get(x.hypothesisId)?.projectId!==x.projectId || decisionMap.get(x.decisionId)?.projectId!==x.projectId) fail(`hypothesis-decision link "${x.id}" is invalid or cross-project.`);});
  hypotheses.forEach((hypothesis)=>{const result=calculateScore(evidenceSignals.filter((evidence)=>evidence.hypothesisId===hypothesis.id)); hypothesis.confidenceScore=result.score; hypothesis.status=result.status;});
  return { formatVersion:2, exportedAt:data.exportedAt as string, projects, segments, sources, evidenceSignals, hypotheses, decisions, evidenceDecisionLinks, hypothesisDecisionLinks };
}

export async function exportDatabase(): Promise<string> {
  const data: DatabaseExport = { formatVersion:2, exportedAt:new Date().toISOString(), projects:await db.projects.toArray(), segments:await db.segments.toArray(), sources:await db.sources.toArray(), evidenceSignals:await db.evidenceSignals.toArray(), hypotheses:await db.hypotheses.toArray(), decisions:await db.decisions.toArray(), evidenceDecisionLinks:await db.evidenceDecisionLinks.toArray(), hypothesisDecisionLinks:await db.hypothesisDecisionLinks.toArray() };
  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<string | null> {
  if (new TextEncoder().encode(jsonString).byteLength > MAX_BACKUP_BYTES) fail('file exceeds the 25 MB backup limit.');
  let parsed: unknown; try { parsed=JSON.parse(jsonString); } catch { fail('file is not valid JSON.'); }
  if (!isRow(parsed)) fail('expected a JSON object.');
  const data=validateBackup(parsed);
  await db.transaction('rw', [db.projects,db.segments,db.sources,db.evidenceSignals,db.hypotheses,db.decisions,db.evidenceDecisionLinks,db.hypothesisDecisionLinks], async()=>{
    await Promise.all([db.projects.clear(),db.segments.clear(),db.sources.clear(),db.evidenceSignals.clear(),db.hypotheses.clear(),db.decisions.clear(),db.evidenceDecisionLinks.clear(),db.hypothesisDecisionLinks.clear()]);
    await db.projects.bulkAdd(data.projects); await db.segments.bulkAdd(data.segments); await db.sources.bulkAdd(data.sources); await db.evidenceSignals.bulkAdd(data.evidenceSignals); await db.hypotheses.bulkAdd(data.hypotheses); await db.decisions.bulkAdd(data.decisions); await db.evidenceDecisionLinks.bulkAdd(data.evidenceDecisionLinks); await db.hypothesisDecisionLinks.bulkAdd(data.hypothesisDecisionLinks);
  });
  return data.projects[0]?.id ?? null;
}
