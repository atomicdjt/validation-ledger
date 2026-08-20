# Validation Ledger

**Turn customer conversations into traceable product decisions.**

**Built by David Turner · [atomicdjt](https://github.com/atomicdjt)**

### What is this?
Validation Ledger is a polished, local-first research workspace for capturing customer evidence, testing product hypotheses, and recording decisions without losing the source material behind them.

### Who is it for?
Product managers, UX researchers, and founders who need to synthesize user interviews and qualitative feedback into robust, evidence-backed product decisions rather than relying on gut feeling.

### Why is it interesting?
It replaces black-box AI summaries and scattered notes with a transparent reasoning chain (`Source → Evidence signal → Hypothesis → Decision`). It features an explainable support scoring model, local-first core data storage via IndexedDB, and optional AI assistance (where Gemini requests occur only when explicitly initiated by the user).

### Can I see it?
Yes! **[Live Production Demo](https://validation-ledger.vercel.app)**
*(Technical deep-dives: [Architecture](docs/ARCHITECTURE.md) · [Release validation](docs/VALIDATION.md) · [Security](SECURITY.md) · [Full portfolio](https://ai-project-portfolio-portfolio-hub.vercel.app/))*

### Where is the evidence?
The app computes an explicit support strength score based on:
- Independent supporting sources
- Segment diversity
- Behavioral or willingness-to-pay evidence
- Direct verbatim source citations
Contradicting evidence is weighed separately, preventing positive bias from erasing material counterevidence.

![Validation Ledger dashboard](docs/images/dashboard.png)

**More by David Turner:** [BuildWorld AI](https://github.com/atomicdjt/buildworld-ai) · [WeaveStudio](https://github.com/atomicdjt/weavestudio) · [GitHub profile](https://github.com/atomicdjt)

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

Validation Ledger is open source under the [MIT License](LICENSE). Copyright © 2026 atomicdjt.
