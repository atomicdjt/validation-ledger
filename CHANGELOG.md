# Changelog

## [1.1.0] - 2026-09-26

### Security & Integrity
- **CRITICAL**: Fixed an integrity flaw in the SHA-256 revision hashing architecture where nested objects were not serialized deterministically, causing silent chain validation failures.
- Implemented a strictly deterministic, recursive JSON serialization engine for revision canonicalization.
- Hardened timestamp assignment in `governance.ts` to use a localized lock, preventing concurrency fork vulnerabilities in the hash chain.
- Separated `contentHash` from `generatedAt` in Decision Package exports to ensure reproducible artifact validation.

### Changed
- Public UI Terminology: Renamed "Hypothesis" to "Claim" across the user interface to improve clarity and reduce academic terminology. (Internal database IDs and schemas remain legacy-compatible to prevent migration overhead).
- Product Positioning: Updated the branding, meta tags, and README from "Evidence-Driven Product Discovery" to "Traceable Decision Governance" to accurately reflect the product's value proposition.

### Added
- Added concurrency stress testing (`Scenario I`) to guarantee data integrity during parallel writes.
- Added adversarial unit tests simulating DB tampering (reason forgery, actor forgery, previousHash forgery) to prove cryptographic chain rejection.
- Created `docs/INTEGRITY_MODEL.md` to document the guarantees and boundaries of the local-first tamper-evident ledger.
