# Assisted CSV review: delivery rehearsal

This is a prepared service experiment, not a claim of paying customers or operator competence. The proposed fee is USD 300, subject to a written scope agreement. Activate this experiment only if the preceding n8n experiment fails its decision gate.

## Scope agreed before work

One HubSpot contact CSV, no more than 2,000 data rows, reviewed with the customer on their own computer. Allow at most five delivery hours. Ask for the problem, row count, column names and desired outcome first, not their contact export. Decline live CRM merges/deletions, history migration, automatic field enrichment and broader cleanup.

The free checker stays free. The fee covers assisted review and the delivery record. Do not promise a CRM accuracy rate or guaranteed duplicate removal. Matching scores are not calibrated probabilities. The voter-derived evaluation is a limited name/locality benchmark, not a CRM validation.

## Local session

1. Confirm the customer is authorized to handle the file and has an untouched backup. Use the checker on their computer. No recording; no CSV transfer to the provider or general AI tools. Screen sharing is optional and exposes displayed rows to the facilitator, so agree on it explicitly.
2. Count rows and confirm the five mappings: Email, First Name, Last Name, Phone and Company. Stop on parser warnings or ambiguous mappings until the customer resolves them. Record column labels and issues, not contact values, in the service notes.
3. Run the scan. Every group begins unreviewed. Explain that the selected master row is proposed by the tool; approval keeps that complete row without combining fields. If that row is unsuitable, keep the group intact for customer-side review.
4. Let the customer decide each reviewed group. Use **Keep selected row** only when they approve the same-person judgment and retained row; use **Keep both** for conflicts. Leave uncertain groups unreviewed. Do not force a decision to finish the job.
5. Download the audit report locally. It includes candidate-row source fields and is sensitive. Verify the saved file before continuing. The original CSV is still needed for rows outside candidate groups.
6. Open **Review export**. Reconcile original, removed and retained row counts. The customer separately confirms review and backup, then downloads the reviewed CSV. A changed decision requires a new audit download and confirmation.
7. Check the retained headers, source-row values and decisions. Retain all files on the customer's computer. Importing fewer rows does not merge or delete existing HubSpot records; live CRM changes are outside this service.

## Acceptance and rollback

Deliver a field mapping list, data-quality issues, customer decision summary, reviewed CSV, audit CSV and import checklist. Mark unresolved groups explicitly. Acceptance requires that only approved rows were omitted and that retained rows preserve their source values. Do not call a scan result “clean” or “complete”.

The rollback is the original CSV: no source file or CRM state is changed by this service. If an omission is disputed, stop using the reviewed CSV and repeat from the backup, leaving the affected group intact. If a false same-person decision is detected, record it and pause the service experiment for review.

Before any import, the customer must confirm the destination behavior, identifier mapping, backup and small test import through their own CRM process. No import is performed in this rehearsal.

## Evidence and time recording

Run `npm test`, `npm run lint`, `npm run build` and `npm run test:e2e`. The service browser test uses only the checked-in synthetic demo, preserves unreviewed and keep-both rows, verifies audit fields and checks separate export approval. Generated CSV artifacts go under ignored `test-results/`.

Record operator preparation, sales, review, support, costs and acceptance separately in the central sales ledger. Agent execution time is not the user's delivery speed. The 2,000-row commercial cap is not a tested five-hour completion guarantee; this rehearsal covers 15 synthetic rows only. Operator-led timing and paid acceptance remain unverified.
