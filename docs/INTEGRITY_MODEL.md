# Integrity Model

Validation Ledger employs a tamper-evident, cryptographic hash-chain architecture for Governance Decisions.

## Decision Governance and Traceability
Each Decision goes through a formal governance process and maintains a chronological revision history.
Every change to a Decision or its associated governance artifacts (such as Assumptions, Alternatives, Risks, and Reviews) generates a new Revision.
Each Revision computes a SHA-256 hash over a strictly deterministic canonical JSON representation of its payload, including:
- Entity Type and ID
- Project ID
- Timestamp
- Actor (the user making the change)
- Previous State and New State
- Reason for change
- Previous Revision Hash

This creates a local hash chain. Any direct modification to the underlying IndexedDB storage that bypasses the hash calculation will invalidate the chain, making tampering evident. The integrity of the ledger can be verified at any time in the Settings view.

## Evidence Immutability Semantics
It is important to note that raw Evidence and Claims (Hypotheses) are **not** strictly immutable. 
They can be edited in the UI, and they do not currently have their own cryptographic hash chain. 
However, when Evidence or Claims are linked to a Decision, the state of those links and the Decision's justification is preserved in the Decision's revision history.

## Limitations
This system operates entirely within the local browser (IndexedDB). There is no remote authoritative server or distributed consensus mechanism. If a user entirely deletes their browser profile or local storage, the data is lost. If an adversary modifies the local database and recalculates the entire hash chain from the point of modification, the tampering will go undetected unless the ledger was previously backed up and compared against an external, trusted snapshot.

For true immutability, periodic decision package exports should be independently verified, signed, and stored in a secure external system.
