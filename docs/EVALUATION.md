# Matching evaluation

## Automated evidence in this repository

- Unit and regression tests cover exact email, email `+tag` variants, structured
  email local parts, phone suffix matching, company normalization, nickname
  review candidates, conflict rejection and safe CSV export.
- `tests/demo-regression.test.ts` runs the checked-in 15-row demo from parse to
  grouping and export.
- `npm run benchmark` records deterministic 10,000-row and 50,000-row runs in
  `benchmarks/latest.json`.

## Real-data evidence still required before accuracy marketing

The repository does not contain a real contact export or a safely anonymized
real-world labeled corpus. Synthetic data can catch regressions but cannot prove
real-world precision or recall. Do not publish accuracy rates until an
authorized dataset has been labeled, anonymized and evaluated.

The evaluation record must include dataset provenance, permission, labeling
method, duplicate definition, false positives, false negatives and review-tier
decisions. Never commit raw contact data.
