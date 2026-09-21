# Launch measurement

## Why this changed

An earlier version of this note assumed Vercel request logs would give aggregate
counts for the landing page, the checker and the demo. They do not. This project
is static, with no functions, so it writes no runtime logs: a log query grouped
by request path over a 24-hour window that contained real traffic returned no
rows at all. Nothing was being measured.

## Current setup

Vercel Web Analytics runs on marketing pages only: `/`, `/privacy/`,
`/limitations/` and the four generated campaign landing pages under `/for/`. The script is served from the site's own origin at
`/_vercel/insights/script.js` and reports page views back to that origin, so no
third-party host is involved.

Two policies keep this contained:

| Delivered as | Applies to | `connect-src` |
| --- | --- | --- |
| `vercel.json` header | every path | `'self'` |
| meta tag from the build | the checker at `/app/` | `'none'` |

A browser enforces every policy it receives, so the checker is held to the
stricter one. Path-scoped headers were tried first and reverted: a source
pattern that did not match `/app/` left the checker with no security headers at
all, which a deploy confirmed.

The checker does not load the script, and its own policy would block the report
even if a future change added it by mistake.

Web Analytics must be enabled in project settings, followed by a new deployment.
A 404 alone does not prove the setting is off. On 21 September the API showed
webAnalytics.enabledAt already set, while the previous production script still
returned 404. Verify both the script response and actual pageview ingestion.

## What can be measured

- landing-page visits
- privacy and limitations visits
- referrer, coarse device and country for those visits

## What is not measured

- anything on the checker: opens, demo starts, file selection
- CSV row counts, mapped column names, duplicate candidates or decisions
- downloaded CSV contents

Do not rely on `?from=reddit` for attribution. The current team is on Hobby;
UTM reporting requires Web Analytics Plus or Enterprise. Use distinct page paths:

- `/for/consultants/reddit/`
- `/for/consultants/community/`
- `/for/owners/reddit/`
- `/for/owners/community/`

Vite generates these from the landing HTML. They return their own page without
redirecting to `/`, share the root canonical, and have noindex. Compare page
views by path; this measures visits to a campaign link, not verified membership
in a segment. Forwarded links can cross channels. Record reported segment and
source separately in qualitative feedback. Pageviews do not prove reading or
checker completion. Keep QA visits separate from subsequent campaign counts.

Reference: https://vercel.com/docs/analytics/limits-and-pricing

If deeper product analytics ever become necessary, host the marketing site
separately and keep the checker origin under its current policy. Do not relax the
checker policy to add session replay, browser analytics or error reporting.
