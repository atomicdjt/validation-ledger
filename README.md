# Validation Ledger

**Turn customer conversations into traceable product decisions.**

**Built by David Turner · [atomicdjt](https://github.com/atomicdjt)**

[Live demo](https://validation-ledger.vercel.app) · [Architecture](docs/ARCHITECTURE.md) · [Release validation](docs/VALIDATION.md) · [Security](SECURITY.md) · [Full portfolio](https://ai-project-portfolio-portfolio-hub.vercel.app/)

![Validation Ledger dashboard](docs/images/dashboard.png)

**More by David Turner:** [BuildWorld AI](https://github.com/atomicdjt/buildworld-ai) · [WeaveStudio](https://github.com/atomicdjt/weavestudio) · [GitHub profile](https://github.com/atomicdjt)

Validation Ledger is a polished, local-first research workspace for capturing customer evidence, testing product hypotheses, and recording decisions without losing the source material behind them.

```text
Source → Evidence signal → Hypothesis → Decision
```

## Why it exists

Product discovery often decays into scattered notes and conclusions based on repetition rather than evidence. Validation Ledger keeps the full reasoning chain inspectable: verified excerpts remain attached to sources, supporting and contradicting evidence stay distinct, and hypothesis support strength is calculated with a deterministic, explainable model.

## Highlights

- **Traceable evidence:** connect exact source excerpts to hypotheses as supporting, contradicting, or neutral signals.
- **Explainable support strength:** score independent sources, segment diversity, behavioral evidence, verified citations, and contradictions without a black box.
- **Decision history:** record what was decided, why, and which evidence informed the call.
- **Local-first privacy:** research records remain in the browser through IndexedDB; there is no application backend or cloud database.
- **Integrity-checked backups:** export versioned JSON and atomically restore only after complete schema, size, duplicate-ID, and relationship validation succeeds.
- **Optional AI assistance:** generate untrusted structured suggestions with Google Gemini, verify quoted provenance, and require explicit human acceptance before saving.
- **Responsive workflow:** polished desktop navigation and purpose-built mobile layouts.

## Product tour

The workspace includes project and hypothesis management, a source library, source-level evidence extraction, an evidence matrix, decision tracking, reporting, backup controls, and guided demo data.

<p align="center">
  <img src="docs/images/source-mobile.png" alt="Validation Ledger source detail on mobile" width="380" />
</p>

## Technology

- React 19, React Router 7, TypeScript 6, and Vite 8
- Tailwind CSS 4 with a custom token-based design system
- Dexie 4 and IndexedDB for browser-local persistence
- Zustand for small persisted interface preferences
- Google Gemini as an optional, user-configured extraction assistant
- Vitest and Oxlint for deterministic tests and static analysis
- Vercel for the static production deployment

## Run locally

Requirements: Node.js 24 and npm 11.

```bash
git clone https://github.com/atomicdjt/validation-ledger.git
cd validation-ledger
npm ci
npm run dev
```

Open the local URL shown by Vite. No environment variable is required for the core product. To use AI extraction, add a restricted Gemini API key in **Settings**; never commit a real key.

## Quality gate

```bash
npm test
npm run lint
npm run build
npm audit
```

The scoring suite covers source independence, segment diversity, behavioral evidence, direct citations, neutral/missing relationships, counterevidence semantics, and source-text revalidation. GitHub Actions repeats unit tests, lint, production build, dependency audit, Chromium workflow, and automated accessibility checks on every push and pull request.

## Data ownership and backups

The IndexedDB database is named `ValidationLedgerDatabase`. Data is tied to the current browser profile and site origin. Use **Settings → Export backup** regularly; clearing browser storage can remove local records. Backup import validates the supported schema before replacing current data in a single transaction.

The live demo does not receive or retain application data on a server. Optional AI extraction sends the selected text and request directly from the browser to Google's API using the key supplied by the user.

## Scoring model

Validation Ledger reports support and counterevidence separately. Supporting strength combines:

- independent supporting sources, capped at 60 points;
- segment diversity, capped at 15 points;
- behavioral or willingness-to-pay evidence, worth 15 points;
- direct source citations, capped at 10 points.

Counterevidence receives its own independently capped score. Credible support plus contradiction is labeled `mixed`; contradiction without support is `contradicted`. This keeps positive evidence from erasing material counterevidence.

Only excerpts that match the saved source exactly or through conservative whitespace/quotation normalization may be treated as direct evidence. Missing or unverified provenance is displayed as an inference, never as a quote. The score is an aid to judgment, not proof of market demand. AI-generated suggestions also require human review.

## Documentation

- [Architecture and system boundaries](docs/ARCHITECTURE.md)
- [Release checks and current limitations](docs/VALIDATION.md)
- [Security and responsible key handling](SECURITY.md)
- [Contribution workflow](CONTRIBUTING.md)

## License

Copyright © 2026 atomicdjt. All rights reserved. The repository is public for portfolio review; no license to redistribute or create derivative works is granted unless provided separately in writing.
