# Privacy-preserving launch measurement

The checker keeps `connect-src 'none'`. It does not ship an analytics script,
send events or expose contact data to a backend.

## What can be measured

Vercel request logs provide aggregate counts for:

- `/` — landing-page requests
- `/app/` — checker opens
- `/app/?demo=1` — demo starts from the landing page

These requests happen before the user chooses a CSV. They do not contain file
contents, contact count, column mapping, match results or export decisions.

## What will not be measured

- file-selection events
- CSV row counts
- mapped column names
- duplicate candidates or decisions
- downloaded CSV contents

If product analytics become necessary, host the marketing site separately and
keep the checker origin under its current Content Security Policy. Do not relax
the checker policy to add session replay, browser analytics or error reporting.
