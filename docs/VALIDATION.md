# Release validation

The release gate is intentionally reproducible:

```bash
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
```

## What is covered

- Deterministic support and counterevidence behavior, including neutral defaults, source independence, segment diversity, behavioral evidence, citations, mixed evidence, and score bounds.
- TypeScript compilation and production bundling.
- Static analysis through Oxlint.
- Dependency vulnerability review with `npm audit`.
- Chromium automation for the project-to-backup workflow and axe checks on primary routes.
- Production URL and direct-route checks after deployment.

## Current limits

- Automated accessibility checks catch only a subset of problems and are not WCAG certification.
- IndexedDB is tied to the browser profile and origin; users should export backups regularly.
- AI extraction quality depends on the selected model and source material. Suggestions are staged, quote-checked, and require explicit human acceptance.
- A passing build does not independently establish accessibility, privacy, security, or regulatory compliance.
