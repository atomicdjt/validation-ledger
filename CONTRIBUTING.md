# Contributing

Thanks for helping improve Validation Ledger.

## Local workflow

1. Use Node.js 24 and run `npm ci`.
2. Create a focused branch from `main`.
3. Keep data-model changes backward compatible with existing IndexedDB records.
4. Add or update tests for deterministic logic.
5. Run `npm test`, `npm run lint`, and `npm run build` before opening a pull request.

Please keep pull requests focused and describe the user impact, test evidence, and any data-migration implications.
