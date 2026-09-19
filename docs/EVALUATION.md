# Matching evaluation

## Automated evidence in this repository

- Unit and regression tests cover exact email, email `+tag` variants, structured
  email local parts, phone suffix matching, company normalization, nickname
  review candidates, conflict rejection and safe CSV export.
- `tests/demo-regression.test.ts` runs the checked-in 15-row demo from parse to
  grouping and export.
- `npm run benchmark` records deterministic 10,000-row and 50,000-row runs in
  `benchmarks/latest.json`.

## Real-person benchmark evidence

`evaluations/nc-voters-5000-2026-09-19.json` records a deterministic evaluation
against the Database Group Leipzig North Carolina Voters 5M benchmark. That
benchmark starts from real voter records and creates controlled corrupted
duplicates with ground-truth cluster identifiers. The source publishes the
benchmark under a Creative Commons license.

The sample fixes the first 5,000 identities from source 0, then selects their
records from all five sources. It contains 21,703 rows and 38,686 true duplicate
pairs. DedupeSafe received `givenname` as First Name, `surname` as Last Name and
`suburb` as Company context. Email and Phone were blank.

Results:

- automatic tier: 0 predicted pairs, 0 false positives, recall 0;
- review tier: 16,056 predicted pairs, 16,023 true positives and 33 false
  positives;
- all candidates: precision 0.9979 and recall 0.4142, with 22,663 false
  negatives.

This benchmark tests name matching with locality context. It does not measure
performance on CRM emails, phone numbers or real company fields. The real names
and locations never entered the repository; only the aggregate report, source
metadata, dataset fingerprint and row-number error pairs were committed. Do not
turn these results into a general CRM accuracy claim.

The evaluation record includes dataset provenance, permission, labeling method,
duplicate definition, false positives, false negatives and review-tier results.
Never commit raw contact data.

## Run the evaluation

Prepare an authorized CSV with these headers:

```text
entity_id,Email,First Name,Last Name,Phone,Company
```

Rows that describe the same person must share one `entity_id`. Create a separate
metadata JSON file with non-empty `provenance`, `permission`, `labelingMethod`,
`duplicateDefinition` and `anonymization` strings. Do not put names, emails,
phone numbers or other personal data in the metadata.

Run:

```powershell
npm run evaluate -- C:\safe\labeled.csv C:\safe\labeled.meta.json C:\safe\evaluation.json
```

The report contains a SHA-256 fingerprint, aggregate precision/recall counts and
row-number pairs for errors. It does not copy contact values or `entity_id`
values. Keep the source CSV outside the repository.
