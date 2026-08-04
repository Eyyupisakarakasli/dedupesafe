# HubSpot Duplicate Contact Checker

Find duplicate contacts in a HubSpot CSV export — including the ones exact-match tools miss, like `john@acme.com` vs `john.smith@acme.com`.

Everything runs in your browser. Your contact file never leaves your device.

👉 **[hubspot-dup-checker.vercel.app](https://hubspot-dup-checker.vercel.app)**

---

## Why

HubSpot's built-in duplicate management only reliably catches exact email matches. Real CRM data is messier: the same person entered twice with a work email and a personal one, a nickname instead of a legal name, a company written as both `Acme Corp` and `ACME Corporation`.

This tool scores contacts across five fields, groups the likely duplicates, picks the most complete record as the master, and exports a cleaned CSV.

## Privacy

This is the whole point of the product, so it's worth being precise:

- **No server.** No backend, no database, no account. The app is static files.
- **No network requests at runtime.** The app makes zero `fetch`/XHR calls. The demo CSV is inlined into the JS bundle at build time, not downloaded.
- **Enforced, not just promised.** The deployed site ships `Content-Security-Policy: connect-src 'none'` plus `script-src 'self'` (see `vercel.json`). The browser blocks the page from opening any network connection, so the app *cannot* upload your contacts even if a future dependency tried to.
- **No analytics, telemetry, third-party scripts, or CDN fonts.**

Verify it yourself: open DevTools → Network, run a full scan, and watch it stay empty.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run test` | Vitest unit tests |
| `npm run lint` | Oxlint |

## How to use it

1. **Export from HubSpot.** Contacts → *Export*, CSV format. Include at least the email column; first name, last name, phone, and company all improve accuracy.
2. **Drop the file in.** Nothing uploads — the file is read locally.
3. **Confirm the column mapping.** The app guesses your columns and shows a sample value from row 1 next to each. **Check these** — a wrong guess silently poisons the whole scan. Any field except email can be set to *Skip*.
4. **Review the groups.** Each group shows its confidence score, the contacts in it, which record was picked as master (★), and which values differ from the master.
5. **Dismiss false positives.** Hit **Not a duplicate** on any group that's wrong; its contacts are then kept in full in the export. Dismissed groups are listed at the bottom and can be restored individually or all at once.
6. **Download the cleaned CSV.** The button states exactly how many rows will be kept and how many removed before you click.

## How matching works

Each candidate pair is scored 0–100 as a weighted average over the fields that **both** contacts have filled in. A field empty on either side is skipped entirely — it neither helps nor hurts the score.

### The rule that matters

Two rows are only ever linked when they share a **strong identifier**. Names, companies and
first-name similarity can *corroborate* an identity but can never establish one on their own —
otherwise everyone called Mehmet at one employer collapses into a single "duplicate".

| Identifier | Strength | Confidence ceiling |
|---|---|---|
| Identical email, or identical apart from a `+tag` | decisive | 100% |
| Identical phone number (or same last 9 digits, min 7) | decisive | 100% |
| Same domain, local-part variant (`john@` ~ `john.smith@`, `j.smith@` ~ `john.smith@`) | strong | 95% |
| Same handle at another provider (`x@acme.com` ~ `x@gmail.com`), or two near-identical bare handles | probable | 85% |

A **probable** identifier additionally requires at least one other field to agree.

Two `first.last@` addresses are compared component by component, so `mustafa.yilmaz@` and
`mustafa.yildirim@` are *different people*, while `j.smith@` and `john.smith@` are the same one.

**Conflict rule:** if both rows carry a surname and the surnames clearly differ, the pair is
rejected outright — even on an identical email. This is what stops a shared `info@` inbox and a
shared switchboard number from merging colleagues.

Once a pair passes, it is scored as a weighted average over the fields both rows populate:

| Field | Weight |
|---|---|
| Email | 0.35 |
| Phone | 0.25 |
| Last name | 0.15 |
| Company | 0.15 |
| First name | 0.10 |

A differing email, phone or company is treated as *no evidence* rather than evidence against —
a person legitimately has a work address and a personal one. Fuzzy string scores below 0.7 are
treated as zero, so an unrelated surname contributes nothing instead of a misleading 0.45.

Pairs scoring **≥ 50** are linked, then merged transitively via union-find.

| Score | Level |
|---|---|
| ≥ 90 | 🔴 certain |
| ≥ 70 | 🟠 likely |
| ≥ 50 | 🟡 possible |

**Kept record** = the contact with the most non-empty fields; ties go to the row carrying more
detail ("Jonathan" over "Jon"), then to the earliest row. On export only that row survives from
each group. Contacts in dismissed groups, and contacts in no group, are always kept as-is.

The results screen lists **merge suggestions** — values present on a discarded row but missing
from the kept one — so you can carry them over in HubSpot before deleting anything.

### On the demo data

`src/data/demo-hubspot-contacts.csv` holds 15 contacts with 7 deliberately planted duplicate
pairs. The matcher finds **6 of 7**. The miss is `Bob Johnson` / `Robert Johnson` — a nickname
pair with different emails and phones, which needs a nickname dictionary to catch.

## Known limitations

Read these before trusting the output on a real list.

- **Nicknames are not matched.** Bob/Robert, Bill/William, Kate/Katherine. There is no nickname table.
- **A duplicate with no shared email or phone will be missed.** That is the deliberate trade-off
  behind the strong-identifier rule: the tool prefers missing a duplicate over deleting a real contact.
- **Large files are slow.** Roughly 3 s for 10,000 contacts and about 45 s for 50,000 on a typical
  laptop. The scan is synchronous, so the tab is unresponsive while it runs; a warning appears above
  20,000 rows. Split very large exports.
- **An email column is required** to start a scan.
- **Non-Latin company names are ignored** for scoring. Company names are reduced to Latin letters
  and digits, so a CJK/Cyrillic/Arabic-only name contributes 0 rather than a wrong score.
- **A married-name change looks like a conflict.** Two rows for the same person under different
  surnames are rejected unless the email or phone matches exactly.
- **Nothing is merged for you.** The export keeps one row per group and drops the rest; it does not
  combine values across rows. **Review before re-importing anything into HubSpot.**
- **A column literally named `__proto__` loses its values.** It no longer crashes the scan, but
  papaparse cannot store that key, so the column exports empty.

## Project structure

```
src/
  core/
    matcher.ts   identifier gate, scoring, blocking, union-find grouping
    csv.ts       parsing (papaparse), column detection, normalisation
    export.ts    cleaned-CSV generation, injection-safe escaping, download
    types.ts     shared types
  App.tsx        upload → mapping → scanning → results flow
  ErrorBoundary.tsx
  App.css
  data/          demo CSV (inlined into the bundle at build time)
tests/
  matcher.test.ts
```

Stack: React 19, TypeScript, Vite, papaparse, vitest. Deployed as a static site on Vercel.

## Contributing

Run `npm run test` and `npm run build` before committing. When touching `matcher.ts`, re-run the demo CSV and confirm the group count hasn't regressed — scoring changes are easy to make and hard to notice.
