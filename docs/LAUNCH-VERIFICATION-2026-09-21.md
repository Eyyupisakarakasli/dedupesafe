# Launch fixes verified on 21 September 2026

Implementation commit: `88d5c72`.
Production deployment: `dpl_4wY1f637Zd3c78J5TgLnYZ2whahY`.
Public URL: https://dedupesafe.vercel.app

## Data preservation

Audit CSV includes every original column from every candidate row, including
removed rows and custom CRM fields. Numbered source-column labels separate them
from audit metadata. CSV formula protection still applies; this is a safe
spreadsheet report, not a byte-for-byte copy of the input. Keep the original.

Reducing the exported rows requires starting an audit download and confirming
the export. A changed decision resets both. The browser cannot prove that the
download was saved, so the UI asks the user to verify it. Fields are not merged;
the reviewed CSV keeps the selected row. It does not merge portal records.

## Checks executed

- 86 unit/regression tests passed, including removed custom values, Unicode,
  multiline quoting, metadata separation, formula protection and decision precedence.
- Lint and production build passed; dependency audit reported zero vulnerabilities.
- All three owned Playwright launch tests passed locally and on production.
  A concurrently added service-rehearsal test also passed on production (four
  total in that run); that file was not authored or committed in this change.
- The custom-field browser test verifies audit content and the approval reset.
- Four campaign paths return 200 at their own URL with noindex and root canonical.
- `/app`, `/app/`, `/app/?demo=1`, `/app/index.html` deliver the checker's restrictive
  CSP meta and contain no analytics script. A fresh HTTP check of `/app/` also
  confirmed the global CSP header, `X-Frame-Options: DENY`, and HSTS.
- A production demo scan produced no fetch/XHR/beacon/WebSocket data requests.

## Analytics evidence

The authenticated project API already showed `webAnalytics.enabledAt` before
deployment. The old script was 404; redeployment fixed it (200). The team is on
Hobby. No plan purchase or upgrade was made.

The tracking script intentionally ignores headless/webdriver browsers. Ordinary
in-app-browser QA visits, not fabricated events, were used for ingestion checks.
The documented Web Analytics API returned:

```json
[
  {"requestPath":"/for/consultants/reddit","visitors":1,"pageviews":1},
  {"requestPath":"/for/owners/community","visitors":1,"pageviews":1}
]
```

These are QA visits, not evidence of demand. Query: `/v1/query/web-analytics/visits/aggregate`,
project `prj_IxQPa8OpYktVfG4OAtguYFWG9990`, team `team_61dbollL2FDNeL1Psii16HzF`,
`since=2026-09-21`, `until=2026-09-22`, `by=requestPath`. The API normalizes the
trailing slash in these results. Dashboard login was unavailable; API results
verify the same aggregated dataset without claiming a dashboard screenshot.

References: https://vercel.com/docs/analytics/quickstart,
https://vercel.com/docs/analytics/web-analytics-api,
https://vercel.com/docs/analytics/limits-and-pricing.

## Still open before distribution

- Founder creates a dedicated product mailbox and supplies its real address;
  no unowned address was published. Suggested: `dedupesafe.feedback@gmail.com`
  (availability not checked).
- Verify sending/receiving, then add the address and a privacy-safe feedback
  template to landing/checker/privacy. Do not request source CSVs or audits.
- Founder performs the HubSpot Free import/export rehearsal and observes the
  paid duplicate-manager access restriction.
- Verify current posting rules and account access for the selected channel.

No outreach or promotional post was sent. The pre-existing benchmark change
and concurrent README/service-readiness edits were left outside this work.
