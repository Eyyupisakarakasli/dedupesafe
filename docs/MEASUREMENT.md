# Launch measurement

## Why this changed

An earlier version of this note assumed Vercel request logs would give aggregate
counts for the landing page, the checker and the demo. They do not. This project
is static, with no functions, so it writes no runtime logs: a log query grouped
by request path over a 24-hour window that contained real traffic returned no
rows at all. Nothing was being measured.

## Current setup

Vercel Web Analytics runs on the marketing pages only: `/`, `/privacy/` and
`/limitations/`. The script is served from the site's own origin at
`/_vercel/insights/script.js` and reports page views back to that origin, so no
third-party host is involved.

The Content Security Policy is split to keep this contained:

| Path | `connect-src` |
| --- | --- |
| `/app/*` — the checker | `'none'` |
| everything else — marketing pages | `'self'` |

The checker does not load the script, and its policy would block the report even
if a future change added it by mistake.

Web Analytics must be enabled once in the Vercel project settings. Until it is,
the script returns 404 and no page view is recorded.

## What can be measured

- landing-page visits
- privacy and limitations visits
- referrer, coarse device and country for those visits

## What is not measured

- anything on the checker: opens, demo starts, file selection
- CSV row counts, mapped column names, duplicate candidates or decisions
- downloaded CSV contents

A channel can still be attributed by giving each post its own query string, for
example `/?from=reddit`, which arrives in the page address Web Analytics records.

If deeper product analytics ever become necessary, host the marketing site
separately and keep the checker origin under its current policy. Do not relax the
checker policy to add session replay, browser analytics or error reporting.
