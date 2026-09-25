# Local design review — 2026-09-25

Status: local preview only; no push or production deployment.
Preview: http://127.0.0.1:4175/

- English, Turkish and German interface dictionaries, including landing, checker, privacy and limitations.
- Light, dark and system appearance. Language and appearance preferences persist on this device; no contact data is saved with them.
- Shared semantic colors, restrained cards, stronger type hierarchy and responsive controls.
- CSV source headers, values and download formats remain unchanged.

Verification:
- Production build and lint passed.
- 97 unit tests passed, including dictionary parity and dynamic placeholder preservation.
- Browser: German demo scanned 15 contacts into 7 candidate groups. Selected CSV row 10, approved the group, then switched to Turkish: 1 approved group and 14 output rows remained.
- Export review still required the audit download and explicit confirmation; final CSV download remained disabled before those steps.
- Browser: preference persistence between landing and checker, light/dark switching, German and Turkish 390px layouts; document width 375px inside 390px viewport (no horizontal overflow).
- Corrected stale-language screen-reader announcements discovered during review.
- Checker build retains connect-src 'none'.

Scope: language selection changes presentation, not the matching engine. English-name matching limitations still apply. Parser-provided technical error details and the feedback email template can remain in English.
