# Readiness evidence — 2026-09-21

## Executed locally

| Check | Result |
| --- | --- |
| `npm.cmd test` | 5 files, 86 tests passed; Vitest reported 547 ms |
| `npm.cmd run lint` | Passed (including the new browser rehearsal test) |
| `npm.cmd run build` | Passed; production checker retains `connect-src 'none'` |
| `npm.cmd run test:e2e` | 4 Chromium tests passed; Playwright reported 6.5 seconds |
| New service browser rehearsal | Passed; 1.9 seconds within the suite |

The browser suite launched the actual local Vite app and exercised the browser worker and download controls. This was not a manual customer delivery or a production deployment. Build warning: the existing marketing-only Vercel analytics script is not a module and cannot be bundled; build still completed. Test runner also emitted a `NO_COLOR`/`FORCE_COLOR` environment warning.

Recorded agent verification window: 12:07:40 to 12:10:24, Europe/Istanbul, on the date above (164 seconds, excluding initial inspection and subsequent documentation). These timestamps and runner durations measure agent activity only, not a five-hour human delivery qualification.

## Observed synthetic flow

Source: `src/data/demo-hubspot-contacts.csv` (15 rows). Browser test: `tests/e2e/service-rehearsal.spec.ts`.

- All five column mappings matched their source headers.
- Seven candidate groups were displayed. One group was approved, one marked keep-both and five left unreviewed.
- Download remained disabled after checkbox approval until the audit download started.
- Audit contained 14 candidate rows, all three decision states and every original source field for those rows.
- Reviewed CSV contained 14 rows and the same header order. Exact row comparison showed that only the single non-master row in the approved group was omitted; every other row remained identical.
- The source file remained byte-for-byte unchanged.
- Existing browser tests separately verified that changing a decision resets confirmation and the audit prerequisite, and that an otherwise missing custom value survives in the audit.

Synthetic export receipts are stored beside this report. They contain invented demo contacts, not customer records. Their purpose is to inspect the delivery behavior, not to measure matcher precision or demonstrate revenue.

## Changes and boundaries

Added the service rehearsal browser test, this result, runbook and synthetic receipts. Updated only the evaluation paragraph in README to acknowledge the existing voter-derived aggregate report and explicitly exclude general CRM accuracy claims. Preserved the preexisting README button-label edit and all other preexisting dirty files.

No product logic, privacy policy, network capability, payment integration, marketing campaign or deployment was added. No messages were sent. Unit tests include preexisting dirty export changes; passing tests do not turn those changes into newly authored work.

Open gates: the user's own timed rehearsal, account/payment readiness, actual customer consent, paid acceptance, 2,000-row practical review effort and real CRM accuracy. Do not infer these from an automated 15-row run.

## Rechecked before Git publication — 2026-09-22

The service rehearsal browser test passed again (1 test; runner total 3.7 seconds).
Both checked-in synthetic CSV receipts matched the freshly downloaded browser
outputs by SHA-256. This recheck does not requalify the historical timing or
commercial assumptions above.
