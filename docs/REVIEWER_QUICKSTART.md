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

## 12-minute product researcher exercise

Use a disposable browser profile with the [demo](https://validation-ledger.vercel.app/) or run the app locally. This exercise uses invented material only; do not enter real participant, client, or confidential research. No Gemini key is needed.

### Task

Create a project named **Maple Market substitutions**. Describe it as a pickup-order board that flags substitutions before packing, with the objective of checking whether independent grocers need a staff workflow for substitutions.

Add this claim: **Small independent grocers will pay for a shared board that flags substitutions before packing.** Then add two interview sources, using the identifiers **Fictional market owner A** and **Fictional market owner B** and the source text below:

- **Owner A:** “I would pay for a shared board if it flags a substitution before packing. Last month, two shoppers arrived after we swapped an item without telling them. It has to take less than a minute per order.”
- **Owner B:** “We tried a substitution message for every item last month. Staff spent more time answering replies than packing, and I would not pay for another dashboard.”

For each source, save the text and add a manual evidence signal. Summarize the observation, paste the matching sentence into the provenance quote, link the claim, and mark the relationship **Supports** for A and **Contradicts** for B. Treat a quote as direct only when the app reports matching provenance.

Record a **proposed**, **low-confidence** decision titled **Run a workflow test before pricing**. Link it to the claim and both evidence signals. Include the alternative of launching the paid board now, the assumption that a triage workflow can reduce interruptions without adding staff work, and a validation method that observes a short prototype workflow. State in the outcome that this exercise uses synthetic material and establishes no real demand.

### Completion and failure criteria

The task passes when the two source records retain their exact text, one linked signal supports the claim, the other contradicts it, the claim remains visibly mixed, and the proposed decision links to both signals while preserving the unresolved assumption. The decision must remain a proposal; this material cannot establish demand or justify a real launch.

Record a task failure if the researcher cannot complete it in 12 minutes without help, cannot tell how to retain the contradictory signal, sees a direct quote accepted without matching source text, sees the claim presented as strongly supported despite the counterevidence, or cannot link the decision to both signals. Record the step and exact label or behavior that caused the failure. A different reasoned decision is acceptable if it remains proposed, low confidence, and explicitly accounts for both signals.

### Feedback to capture

- Completion time and the step where the researcher paused or needed help.
- Whether **claim**, **evidence**, **direct**, and **contradicts** were understandable in context; note any wording they would change.
- Whether the mixed status and score helped them notice uncertainty or made the conclusion feel more certain than the two fictional sources warrant.
- Whether the decision record captured the alternative, assumption, and next validation step they expected.
- Any unexpected concern about local storage, backup, or what leaves the browser.

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
