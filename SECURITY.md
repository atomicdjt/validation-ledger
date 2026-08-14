# Security policy

## Reporting a vulnerability

Please report security concerns privately through GitHub's **Report a vulnerability** feature when available. Do not include API keys, personal research transcripts, or other sensitive evidence in a public issue.

## Data and key handling

- Application records are stored locally in the browser's IndexedDB database.
- Backups are user-triggered JSON downloads; users control where those files are stored.
- The optional Gemini API key is stored in browser-local settings and is sent directly from the browser to Google's API when AI extraction is requested.
- No authentication, cloud database, or application backend is included.

Because client-side secrets can be inspected by anyone with access to the browser profile, use a restricted API key with appropriate quotas and rotate it if exposure is suspected. Do not use this app for regulated or highly sensitive data without an independent security review.
