# Integrity Model

Validation Ledger employs a tamper-evident, cryptographic hash-chain architecture for Governance Decisions.

## Decision Governance and Traceability
Each governed entity maintains its own hash-linked revision chain. Chain order is reconstructed from `previousHash -> hash` links, not from timestamps.
Every change to a Decision or its associated governance artifacts (such as Assumptions, Alternatives, Risks, and Reviews) generates a new Revision.
Each Revision computes a SHA-256 hash over a strictly deterministic canonical JSON representation of its payload, including:
- Entity Type and ID
- Project ID
- Timestamp (hashed metadata, not sequence identity)
- Actor (the user making the change)
- Previous State and New State
- Reason for change
- Previous Revision Hash

The verifier requires one genesis revision (`previousHash === '0'`), one successor at most for every hash, valid predecessor links, and complete traversal of every revision in the entity chain. It recomputes each SHA-256 hash from the canonical payload before accepting the chain. Direct IndexedDB modification that bypasses the hash calculation is therefore locally detectable unless an attacker can rewrite the affected chain and no independently retained snapshot is available. Integrity can be checked at any time in Settings.

## Backup Integrity
Current-format backups are schema-validated and have every revision chain cryptographically verified before the IndexedDB replacement transaction begins. A malformed payload, hash mismatch, missing predecessor, fork, duplicate hash, or disconnected chain aborts import and leaves the existing database unchanged. Format-1 backups predate revision history; they can be imported to preserve their data, but Settings explicitly warns that their prior governance history cannot be cryptographically verified.

## Evidence Immutability Semantics
It is important to note that raw Evidence and Claims (Hypotheses) are **not** strictly immutable. 
They can be edited in the UI, and they do not currently have their own cryptographic hash chain. 
However, when Evidence or Claims are linked to a Decision, the state of those links and the Decision's justification is preserved in the Decision's revision history.

## Limitations
This system operates entirely within the local browser (IndexedDB). There is no remote authoritative server or distributed consensus mechanism. If a user entirely deletes their browser profile or local storage, the data is lost. If an adversary modifies the local database and recalculates the entire hash chain from the point of modification, the tampering will go undetected unless the ledger was previously backed up and compared against an external, trusted snapshot.

For true immutability, periodic decision package exports should be independently verified, signed, and stored in a secure external system.
