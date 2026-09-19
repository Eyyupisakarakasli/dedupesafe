# Evaluation records

This directory contains reports, not source contact data.

## North Carolina Voters sample, 2026-09-19

`nc-voters-5000-2026-09-19.json` evaluates DedupeSafe against a deterministic
sample of the Database Group Leipzig North Carolina Voters 5M benchmark:

https://leutzsch.informatik.uni-leipzig.de/research/projects/benchmark-datasets-for-entity-resolution

The source describes the benchmark as real North Carolina voter records with
controlled corrupted duplicates and publishes its benchmark datasets under a
Creative Commons license. The report's metadata records the selection and field
mapping. Its SHA-256 fingerprint identifies the exact local sample.

The committed JSON contains aggregate metrics and row-number pairs only. It
contains no names, voter identifiers, email addresses, phone numbers or source
rows. The raw download and derived CSV were deleted after evaluation.

The sample has no email or phone values, and it uses suburb as contextual input
for the Company field. Treat its results as evidence about name-plus-context
candidate generation, not general CRM matching accuracy.
