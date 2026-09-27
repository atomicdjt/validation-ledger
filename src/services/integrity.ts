import { db } from '../db/db';
import type { Revision } from '../db/models';

export interface RevisionHashPayload {
  entityType: string;
  entityId: string;
  projectId: string;
  timestamp: number;
  actor: string;
  previousState: any;
  newState: any;
  reason: string;
  previousHash: string;
}

export function buildRevisionHashPayload(
  entityType: string,
  entityId: string,
  projectId: string,
  timestamp: number,
  actor: string,
  previousState: any,
  newState: any,
  reason: string,
  previousHash: string
): RevisionHashPayload {
  return {
    entityType,
    entityId,
    projectId,
    timestamp,
    actor,
    previousState,
    newState,
    reason,
    previousHash
  };
}

export async function hashRevision(payload: RevisionHashPayload): Promise<string> {
  return await hashData(payload);
}

export function canonicalize(data: unknown): string {
  if (data === null) return 'null';
  if (typeof data === 'boolean') return data ? 'true' : 'false';
  if (typeof data === 'number') {
    if (!Number.isFinite(data)) throw new Error('Non-finite numbers are not supported');
    if (data === 0) return '0';
    return data.toString();
  }
  if (typeof data === 'string') return JSON.stringify(data);
  if (Array.isArray(data)) {
    return '[' + data.map(item => canonicalize(item)).join(',') + ']';
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data as object).sort();
    let result = '{';
    let first = true;
    for (const key of keys) {
      const val = (data as Record<string, unknown>)[key];
      if (val === undefined) continue;
      if (!first) result += ',';
      result += JSON.stringify(key) + ':' + canonicalize(val);
      first = false;
    }
    result += '}';
    return result;
  }
  throw new Error(`Unsupported type for canonicalization: ${typeof data}`);
}

export async function hashData(data: unknown): Promise<string> {
  const canonicalString = canonicalize(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface VerificationFailure {
  valid: false;
  entityId: string;
  revisionId: string;
  index: number;
  reason: 'HASH_MISMATCH' | 'PREVIOUS_HASH_MISMATCH' | 'MISSING_PREDECESSOR' | 'INVALID_CANONICAL_PAYLOAD' | 'DUPLICATE_REVISION' | 'INVALID_SEQUENCE';
}

export interface VerificationSuccess {
  valid: true;
  chainsVerified: number;
  revisionsVerified: number;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

export async function verifyLedgerIntegrity(): Promise<VerificationResult> {
  const revisions = await db.revisions.toArray();
  const revisionsByEntity = new Map<string, Revision[]>();
  
  for (const rev of revisions) {
    if (!revisionsByEntity.has(rev.entityId)) {
      revisionsByEntity.set(rev.entityId, []);
    }
    revisionsByEntity.get(rev.entityId)!.push(rev);
  }

  let chainsVerified = 0;
  let revisionsVerified = 0;

  for (const [entityId, chain] of revisionsByEntity.entries()) {
    chain.sort((a, b) => a.timestamp - b.timestamp);
    let expectedPreviousHash = '0';

    for (let i = 0; i < chain.length; i++) {
      const rev = chain[i];
      if (rev.previousHash !== expectedPreviousHash) {
        return { valid: false, entityId, revisionId: rev.id, index: i, reason: 'PREVIOUS_HASH_MISMATCH' };
      }

      let previousState, newState;
      try {
        previousState = JSON.parse(rev.previousState);
        newState = JSON.parse(rev.newState);
      } catch (e) {
        return { valid: false, entityId, revisionId: rev.id, index: i, reason: 'INVALID_CANONICAL_PAYLOAD' };
      }

      const payload: RevisionHashPayload = {
        entityType: rev.entityType,
        entityId: rev.entityId,
        projectId: rev.projectId,
        timestamp: rev.timestamp,
        actor: rev.actor,
        previousState,
        newState,
        reason: rev.reason,
        previousHash: rev.previousHash,
      };

      try {
        const computedHash = await hashData(payload);
        if (computedHash !== rev.hash) {
          return { valid: false, entityId, revisionId: rev.id, index: i, reason: 'HASH_MISMATCH' };
        }
      } catch (e) {
        return { valid: false, entityId, revisionId: rev.id, index: i, reason: 'INVALID_CANONICAL_PAYLOAD' };
      }

      expectedPreviousHash = rev.hash;
      revisionsVerified++;
    }
    chainsVerified++;
  }

  return { valid: true, chainsVerified, revisionsVerified };
}
