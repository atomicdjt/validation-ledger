# Architecture

Validation Ledger is a static, local-first single-page application.

```text
React UI
  -> domain operations and deterministic scoring
  -> Dexie repository layer
  -> browser IndexedDB

Optional extraction flow
  -> user action
  -> Google Gemini client
  -> structured suggestion review
  -> explicit user save
```

## Boundaries

- `src/pages` owns route-level views.
- `src/components` owns reusable interface and workflow components.
- `src/db` owns models, migrations, CRUD operations, demo data, and backup validation.
- `src/services/evidenceIntegrity.ts` is the trust boundary between model output and durable evidence: it validates links, verifies excerpts, and creates review-only suggestions.
- `src/services/scoring.ts` owns explainable hypothesis confidence scoring.
- `src/services/ai.ts` owns the optional Gemini integration and validates model output before it reaches the UI.
- `src/store` owns small persisted interface preferences rather than research records.

## Deployment

Vite produces a static `dist` directory. Vercel serves the generated assets and rewrites client-side routes to `index.html`, allowing bookmarked routes to load directly.

## Persistence model

Projects contain hypotheses and sources. Evidence signals connect a source excerpt to a hypothesis with a supporting, contradicting, or neutral direction. Decisions can cite the evidence that informed them. Destructive parent operations clean up dependent records in a single Dexie transaction.
