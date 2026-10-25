import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { exportDatabase, importDatabase } from './exportImport';
import type { Revision } from './models';
import { buildRevisionHashPayload, hashRevision } from '../services/integrity';

const complete = () => ({
  formatVersion: 2, exportedAt: new Date(0).toISOString(),
  projects:[{id:'p',name:'P',productDescription:'Desc',validationObjective:'Goal',stage:'discovery',createdAt:1,updatedAt:2}],
  segments:[{id:'s',projectId:'p',name:'Segment',description:'',characteristics:['x'],priority:'high'}],
  sources:[{id:'src',projectId:'p',participantId:'P1',segmentId:'s',date:3,type:'interview',rawText:'Quote',metadata:{channel:'web'},tags:['tag']}],
  evidenceSignals:[{id:'e',projectId:'p',sourceId:'src',segmentId:'s',hypothesisId:'h',relationship:'supports',classification:'pain',statement:'Pain',exactExcerpt:'Quote',isDirect:true,confidence:5,notes:'',createdAt:4,provenanceState:'exact'}],
  hypotheses:[{id:'h',projectId:'p',statement:'H',category:'problem',importance:'critical',status:'weak-evidence',confidenceScore:22,createdAt:5,lastReviewed:6}],
  decisions:[{id:'d',projectId:'p',title:'D',description:'Summary',reason:'R',confidence:'moderate',status:'accepted',alternatives:'Alternative B',assumptions:'Users will adopt this',validationMethod:'Run a usability session',outcome:'Validated by five users',createdAt:7,reviewDate:8}],
  evidenceDecisionLinks:[{id:'ed',projectId:'p',evidenceId:'e',decisionId:'d'}],
  hypothesisDecisionLinks:[{id:'hd',projectId:'p',hypothesisId:'h',decisionId:'d'}],
  revisions: [] as Revision[],
  assumptions: [{id:'a', projectId:'p', decisionId:'d', statement:'assumption', status:'unresolved'}],
  alternatives: [{id:'alt', projectId:'p', decisionId:'d', title:'alt1', description:'', status:'considered'}],
  risks: [{id:'r', projectId:'p', decisionId:'d', description:'risk', severity:'low', status:'unassessed'}],
  reviews: [{id:'revw', projectId:'p', decisionId:'d', reviewer:'user', status:'requested', comments:'', date:10}],
});

async function createRevision(id: string, previousHash: string, newState: unknown, timestamp: number): Promise<Revision> {
  const payload = buildRevisionHashPayload('decision', 'd', 'p', timestamp, 'user', {}, newState, `revision ${id}`, previousHash);
  return {
    id, projectId: 'p', entityType: 'decision', entityId: 'd', timestamp, actor: 'user',
    previousState: JSON.stringify({}), newState: JSON.stringify(newState), reason: `revision ${id}`,
    hash: await hashRevision(payload), previousHash,
  };
}

async function completeWithRevisionChain() {
  const backup = complete();
  const genesis = await createRevision('rev-1', '0', { title: 'first' }, 9);
  const middle = await createRevision('rev-2', genesis.hash, { title: 'second' }, 9);
  const tail = await createRevision('rev-3', middle.hash, { title: 'third' }, 9);
  backup.revisions = [genesis, middle, tail];
  return { backup, genesis, middle, tail };
}

beforeEach(async()=>{await db.delete(); await db.open();});

describe('backup validation and atomic restore',()=>{
  it('round-trips every table and nullable/link field semantically',async()=>{
    await importDatabase(JSON.stringify(complete()));
    const exported=JSON.parse(await exportDatabase()); exported.exportedAt=new Date(0).toISOString();
    expect(exported).toEqual(complete());
    await db.delete(); await db.open(); await importDatabase(JSON.stringify(exported));
    expect(await db.projects.get('p')).toEqual(complete().projects[0]);
    expect(await db.sources.get('src')).toEqual(complete().sources[0]);
    expect(await db.evidenceSignals.get('e')).toMatchObject({hypothesisId:'h',relationship:'supports',provenanceState:'exact'});
    expect(await db.hypotheses.get('h')).toMatchObject({statement:'H',category:'problem',importance:'critical'});
    expect(await db.decisions.get('d')).toMatchObject({
      title:'D',
      description:'Summary',
      reason:'R',
      confidence:'moderate',
      status:'accepted',
      alternatives:'Alternative B',
      assumptions:'Users will adopt this',
      validationMethod:'Run a usability session',
      outcome:'Validated by five users',
    });
    expect(await db.evidenceDecisionLinks.get('ed')).toEqual(complete().evidenceDecisionLinks[0]);
    expect(await db.hypothesisDecisionLinks.get('hd')).toEqual(complete().hypothesisDecisionLinks[0]);
  });
  it.each([
    ['unsupported version',(x:any)=>{x.formatVersion=99;}],
    ['duplicate id',(x:any)=>{x.projects.push({...x.projects[0]});}],
    ['cross-project reference',(x:any)=>{x.sources[0].projectId='missing';}],
    ['invalid enum',(x:any)=>{x.evidenceSignals[0].relationship='guarantees';}],
    ['source/evidence segment mismatch',(x:any)=>{x.evidenceSignals[0].segmentId=null;}],
    ['non-object metadata',(x:any)=>{x.sources[0].metadata='unsafe';}],
  ])('rejects %s without destroying current data',async(_name,mutate)=>{
    await db.projects.add(complete().projects[0]); const backup=complete(); mutate(backup);
    await expect(importDatabase(JSON.stringify(backup))).rejects.toThrow(/invalid backup/i);
    expect(await db.projects.get('p')).toBeTruthy();
  });

  it('recomputes provenance, directness, and derived hypothesis state during restore',async()=>{
    const backup=complete();
    backup.evidenceSignals[0].exactExcerpt='Forged quote';
    backup.evidenceSignals[0].provenanceState='exact';
    backup.evidenceSignals[0].isDirect=true;
    backup.hypotheses[0].confidenceScore=100;
    backup.hypotheses[0].status='strongly-supported';
    await importDatabase(JSON.stringify(backup));
    expect(await db.evidenceSignals.get('e')).toMatchObject({provenanceState:'unverified',isDirect:false});
    expect(await db.hypotheses.get('h')).toMatchObject({confidenceScore:20,status:'weak-evidence'});
  });

  it('imports a valid current backup with a hash-linked revision chain', async () => {
    const { backup } = await completeWithRevisionChain();
    const imported = await importDatabase(JSON.stringify(backup));
    expect(imported).toEqual({ projectId: 'p', integrityWarning: undefined });
    expect(await db.revisions.count()).toBe(3);
  });

  it.each([
    ['changed newState', async (backup: Awaited<ReturnType<typeof completeWithRevisionChain>>) => { backup.backup.revisions[1].newState = JSON.stringify({ title: 'forged' }); }],
    ['changed reason', async (backup: Awaited<ReturnType<typeof completeWithRevisionChain>>) => { backup.backup.revisions[1].reason = 'forged'; }],
    ['changed previousHash', async (backup: Awaited<ReturnType<typeof completeWithRevisionChain>>) => { backup.backup.revisions[1].previousHash = 'forged'; }],
    ['deleted intermediate revision', async (backup: Awaited<ReturnType<typeof completeWithRevisionChain>>) => { backup.backup.revisions = [backup.genesis, backup.tail]; }],
    ['chain fork', async (backup: Awaited<ReturnType<typeof completeWithRevisionChain>>) => {
      backup.backup.revisions.push(await createRevision('rev-fork', backup.genesis.hash, { title: 'fork' }, 9));
    }],
  ])('rejects a %s revision chain before replacing existing data', async (_name, mutate) => {
    const existingProject = { ...complete().projects[0], name: 'Existing local project' };
    await db.projects.add(existingProject);
    const backup = await completeWithRevisionChain();
    await mutate(backup);
    await expect(importDatabase(JSON.stringify(backup.backup))).rejects.toThrow(/revision integrity verification failed/i);
    expect(await db.projects.get('p')).toEqual(existingProject);
  });

  it('rejects malformed JSON without touching existing data', async () => {
    const existingProject = { ...complete().projects[0], name: 'Existing local project' };
    await db.projects.add(existingProject);
    await expect(importDatabase('{not json')).rejects.toThrow(/not valid JSON/i);
    expect(await db.projects.get('p')).toEqual(existingProject);
  });

  it('imports format-1 data without fabricating cryptographic history', async () => {
    const backup = complete() as unknown as Record<string, unknown>;
    backup.formatVersion = 1;
    delete backup.revisions;
    delete backup.assumptions;
    delete backup.alternatives;
    delete backup.risks;
    delete backup.reviews;
    const imported = await importDatabase(JSON.stringify(backup));
    expect(imported.integrityWarning).toMatch(/predates revision history/i);
    expect(await db.projects.get('p')).toBeTruthy();
    expect(await db.revisions.count()).toBe(0);
  });
});
