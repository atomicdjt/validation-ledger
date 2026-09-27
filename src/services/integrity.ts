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
  reason: 'HASH_MISMATCH' | 'PREVIOUS_HASH_MISMATCH' | 'MISSING_PREDECESSOR' | 'INVALID_CANONICAL_PAYLOAD' | 'DUPLICATE_REVISION' | 'DUPLICATE_HASH' | 'MULTIPLE_GENESIS' | 'CHAIN_FORK' | 'DISCONNECTED_REVISION' | 'CYCLE_DETECTED' | 'INVALID_SEQUENCE';
}

export interface VerificationSuccess {
  valid: true;
  chainsVerified: number;
  revisionsVerified: number;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

function failure(
  entityId: string,
  revisionId: string,
  index: number,
  reason: VerificationFailure['reason'],
): VerificationFailure {
  return { valid: false, entityId, revisionId, index, reason };
}

async function verifyRevisionHash(revision: Revision): Promise<'VALID' | 'INVALID_CANONICAL_PAYLOAD' | 'HASH_MISMATCH'> {
  let previousState: unknown;
  let newState: unknown;
  try {
    previousState = JSON.parse(revision.previousState);
    newState = JSON.parse(revision.newState);
  } catch {
    return 'INVALID_CANONICAL_PAYLOAD';
  }

  try {
    const payload = buildRevisionHashPayload(
      revision.entityType,
      revision.entityId,
      revision.projectId,
      revision.timestamp,
      revision.actor,
      previousState,
      newState,
      revision.reason,
      revision.previousHash,
    );
    return (await hashRevision(payload)) === revision.hash ? 'VALID' : 'HASH_MISMATCH';
  } catch {
    return 'INVALID_CANONICAL_PAYLOAD';
  }
}

/**
 * Verifies each entity's revision graph without relying on timestamps. Timestamps
 * remain hashed metadata, but previousHash -> hash is the chain's sequence.
 */
export async function verifyRevisionChains(revisions: Revision[]): Promise<VerificationResult> {
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
    const revisionIds = new Set<string>();
    const revisionsByHash = new Map<string, Revision>();
    const successorsByPreviousHash = new Map<string, Revision[]>();

    for (let i = 0; i < chain.length; i++) {
      const rev = chain[i];
      if (revisionIds.has(rev.id)) {
        return failure(entityId, rev.id, i, 'DUPLICATE_REVISION');
      }
      revisionIds.add(rev.id);

      const hashStatus = await verifyRevisionHash(rev);
      if (hashStatus !== 'VALID') {
        return failure(entityId, rev.id, i, hashStatus);
      }

      if (revisionsByHash.has(rev.hash)) {
        return failure(entityId, rev.id, i, 'DUPLICATE_HASH');
      }
      revisionsByHash.set(rev.hash, rev);

      if (rev.previousHash !== '0') {
        const successors = successorsByPreviousHash.get(rev.previousHash) ?? [];
        successors.push(rev);
        successorsByPreviousHash.set(rev.previousHash, successors);
      }
    }

    for (let i = 0; i < chain.length; i++) {
      const rev = chain[i];
      if (rev.previousHash !== '0' && !revisionsByHash.has(rev.previousHash)) {
        return failure(entityId, rev.id, i, 'MISSING_PREDECESSOR');
      }
      const successors = successorsByPreviousHash.get(rev.hash) ?? [];
      if (successors.length > 1) {
        return failure(entityId, successors[1].id, chain.indexOf(successors[1]), 'CHAIN_FORK');
      }
    }

    const genesisRevisions = chain.filter((revision) => revision.previousHash === '0');
    if (genesisRevisions.length > 1) {
      const duplicateGenesis = genesisRevisions[1];
      return failure(entityId, duplicateGenesis.id, chain.indexOf(duplicateGenesis), 'MULTIPLE_GENESIS');
    }
    if (genesisRevisions.length === 0) {
      return failure(entityId, chain[0].id, 0, 'CYCLE_DETECTED');
    }

    const visitedHashes = new Set<string>();
    let current = genesisRevisions[0];
    let position = 0;
    while (current) {
      if (visitedHashes.has(current.hash)) {
        return failure(entityId, current.id, position, 'CYCLE_DETECTED');
      }
      visitedHashes.add(current.hash);
      revisionsVerified++;

      const successor = successorsByPreviousHash.get(current.hash)?.[0];
      if (!successor) break;
      current = successor;
      position++;
    }

    if (visitedHashes.size !== chain.length) {
      const disconnected = chain.find((revision) => !visitedHashes.has(revision.hash))!;
      return failure(entityId, disconnected.id, chain.indexOf(disconnected), 'DISCONNECTED_REVISION');
    }

    chainsVerified++;
  }

  return { valid: true, chainsVerified, revisionsVerified };
}

/** Returns a verified chain tail, or refuses to append to an invalid history. */
export async function findRevisionChainTail(revisions: Revision[]): Promise<Revision | undefined> {
  if (revisions.length === 0) return undefined;

  const verification = await verifyRevisionChains(revisions);
  if (verification.valid === false) {
    throw new Error(`Cannot append to an invalid revision chain: ${verification.reason}.`);
  }

  const referencedHashes = new Set(
    revisions.filter((revision) => revision.previousHash !== '0').map((revision) => revision.previousHash),
  );
  const tail = revisions.find((revision) => !referencedHashes.has(revision.hash));
  if (!tail) {
    throw new Error('Cannot append to a revision chain without a tail.');
  }
  return tail;
}

export async function verifyLedgerIntegrity(): Promise<VerificationResult> {
  return verifyRevisionChains(await db.revisions.toArray());
}
