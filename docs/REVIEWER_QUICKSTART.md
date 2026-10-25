# Independent reviewer quickstart — Validation Ledger

**Scope:** Local-first evidence → claim → decision workflow on the current repository `main`. [Demo](https://validation-ledger.vercel.app/) · [Governance model](GOVERNANCE_MODEL.md) · [Integrity model](INTEGRITY_MODEL.md).

## Reproduce

Requirements: Node.js 24, npm 11, recent Chromium/Playwright browser. From a clean checkout:

```bash
git clone https://github.com/atomicdjt/validation-ledger.git
cd validation-ledger
npm ci
npm test
npm run lint
npm run build
npm audit --omit=dev
npm audit --audit-level=moderate
npx playwright install chromium
npm run test:e2e
```

For a manual demo, `npm run dev` starts the local interface. The default core workflow does not require an API key or hosted database.

## Inspect the model, not only the interface

1. Create a fresh project and link an explicit claim to a source excerpt. Attempt to mark an altered or unsupported quotation as direct evidence.
2. Add supporting evidence and separate contradictory evidence. Verify that the result reports **both** rather than converting every signal into one confident score.
3. Inspect the factor caps and mixed/contradicted classifications documented in the [README](../README.md#scoring-model) and [governance model](GOVERNANCE_MODEL.md).
4. Export a backup and verify that importing an older or ambiguous format does not magically establish historical integrity. See the [integrity model](INTEGRITY_MODEL.md).
5. Reload or clear site storage in a **disposable browser profile** to understand browser-origin persistence and backup responsibility. Never use real confidential research in a public demonstration.

## Interpret the result conservatively

The deterministic tests and Playwright checks exercise source matching, heuristic scoring, backup/integrity flows, and selected accessibility pathways. A passing suite is not independent evidence of correct real-world research conclusions, customer traction, WCAG certification, or safety/compliance. Browser `IndexedDB` is local to an origin and can be cleared.

**Release boundary:** At the October 20 audit, [PR #38](https://github.com/atomicdjt/validation-ledger/pull/38) was not merged into `main`. Recheck the current base branch and the exact commit under review before treating mixed-evidence demo seeding or any passing local gate as release evidence.

For reproduction limitations and the complete gate, see [release validation](VALIDATION.md) and [security](../SECURITY.md).
