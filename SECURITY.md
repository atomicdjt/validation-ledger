# Security policy

## Reporting a vulnerability

Please report security concerns privately through GitHub's **Report a vulnerability** feature when available. Do not include API keys, personal research transcripts, or other sensitive evidence in a public issue.

## Data and key handling

- Application records are stored locally in the browser's IndexedDB database.
- Backups are user-triggered JSON downloads; users control where those files are stored.
- The optional Gemini API key is kept only in page memory, is cleared on reload or close, and is sent directly from the browser to Google's API when AI extraction is requested.
- No authentication, cloud database, or application backend is included.

Because client-side secrets remain inspectable by scripts running in the page while the key is in use, use a restricted API key with appropriate quotas and rotate it if exposure is suspected. Do not use this app for regulated or highly sensitive data without an independent security review.
