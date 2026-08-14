# Release validation

The release gate is intentionally reproducible:

```bash
npm ci
npm test
npm run lint
npm run build
```

## What is covered

- Deterministic scoring behavior, including source independence, segment diversity, behavioral evidence, citations, contradictions, and score bounds.
- TypeScript compilation and production bundling.
- Static analysis through Oxlint.
- Dependency vulnerability review with `npm audit`.
- Manual responsive browser checks at desktop and mobile widths.
- Production URL and direct-route checks after deployment.

## Current limits

- Browser workflows do not yet have a committed end-to-end automation suite.
- IndexedDB is tied to the browser profile and origin; users should export backups regularly.
- AI extraction quality depends on the selected model and source material. Suggestions require human review.
- A passing build does not independently establish accessibility, privacy, security, or regulatory compliance.
