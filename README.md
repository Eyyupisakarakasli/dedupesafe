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
- **Enforced, not just promised.** The deployed site ships `Content-Security-Policy: connect-src 'none'` (see `vercel.json`). The browser blocks the page from opening any network connection, so the app *cannot* upload your contacts even if a future dependency tried to.
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

| Field | Weight | Comparison |
|---|---|---|
| Email | 0.35 | Exact = 1.0. Same domain with a similar or contained local-part (`j.smith@` vs `jsmith@`) = 0.80–0.85. Different domains = 0. |
| Phone | 0.25 | Exact digits = 1.0. Matching last 8 digits (min 6 digits) = 0.85. |
| Last name | 0.15 | Jaro-Winkler |
| Company | 0.15 | Legal suffixes (`Inc`, `LLC`, `GmbH`, …) stripped, then exact / substring / Jaro-Winkler |
| First name | 0.10 | Jaro-Winkler |

Pairs scoring **≥ 50** are linked, then merged transitively via union-find — if A≈B and B≈C, all three land in one group.

| Score | Level |
|---|---|
| ≥ 90 | 🔴 certain |
| ≥ 70 | 🟠 likely |
| ≥ 50 | 🟡 possible |

**Master record** = the contact with the most non-empty fields. On export, only the master row survives from each group; the others are dropped. Contacts in dismissed groups, and contacts in no group at all, are always kept as-is.

The results screen also lists **merge suggestions** — field values present on a non-master row but missing from the master — so you can carry them over in HubSpot before deleting anything.

### On the demo data

`src/data/demo-hubspot-contacts.csv` holds 15 contacts with 7 deliberately planted duplicate pairs. The current matcher finds **6 of 7**. The miss is `Bob Johnson` / `Robert Johnson` — a nickname pair with different emails and phones, which needs a nickname dictionary to catch.

## Known limitations

Read these before trusting the output on a real list.

- **Nicknames are not matched.** Bob/Robert, Bill/William, Kate/Katherine. There's no nickname table yet.
- **Large files are slow.** Matching is pairwise with blocking on email domain and last-name initial. Small and mid-size exports are fine; **10,000+ contacts can take a very long time and will freeze the tab while it runs** — the scan is synchronous on the main thread. Split large exports, or expect to wait. (The last-name-initial block has only 26 buckets, so it stops helping as files grow.)
- **An email column is required** to start a scan.
- **Non-Latin company names are ignored** for scoring. Company names are stripped to Latin letters and digits, so a CJK/Cyrillic/Arabic-only name contributes 0 rather than a wrong score.
- **Shared inboxes can group unrelated people.** Several different people on `info@company.com` may score as one group, especially when phone and company are blank. Use *Not a duplicate*.
- **Nothing is merged for you.** The export keeps the master row and drops the others; it does not combine field values across rows — that's what the merge suggestions are for. **Review before re-importing anything into HubSpot.**
- **Excel and UTF-8.** The exported CSV has no BOM, so Excel may mangle accented characters. Google Sheets and a HubSpot re-import handle it correctly.

## Project structure

```
src/
  core/
    matcher.ts   scoring, blocking, union-find grouping, master selection
    csv.ts       parsing (papaparse), HubSpot column detection, normalization
    export.ts    cleaned-CSV generation, merge suggestions, download
    types.ts     shared types
  App.tsx        upload → mapping → scanning → results flow
  App.css
  data/          demo CSV (inlined into the bundle at build time)
tests/
  matcher.test.ts
```

Stack: React 19, TypeScript, Vite, papaparse, vitest. Deployed as a static site on Vercel.

## Contributing

Run `npm run test` and `npm run build` before committing. When touching `matcher.ts`, re-run the demo CSV and confirm the group count hasn't regressed — scoring changes are easy to make and hard to notice.
