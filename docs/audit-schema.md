# Audit CSV schema 3

Local implementation: 23 September 2026. Not deployed.

Each candidate row contains `Audit schema version` equal to `3`. Numbered `Source N: header` columns preserve source values and order with existing spreadsheet formula protection. Unique contacts outside candidate groups are not audit rows.

- Decision: keep-one-row, keep-all-rows, unreviewed; keep-separate for individually excluded rows.
- Matching score: comparison score, explicitly not a probability. No internal certainty labels.
- Selected row: current choice, which alone does not authorize removal.
- Values to review: nonempty raw values different from the selected row, including custom fields. These are potential omissions if approved, not proof of removal; consult Row outcome.
- Original group size: membership before individual exclusions.
- Row outcome: kept-selected, removed, kept-separate or kept, reflecting current decisions.
- Review actions: in-session selection, separation and restoration actions; not a timestamped or tamper-proof event log.

Only approved groups remove rows. Other groups and individually separated rows remain intact. Values are never combined. Separating the selected row requires a new selection and approval. Changing selection or membership revokes that group's approval and resets final export confirmation and audit-download readiness. Search and filters never change export scope.

Schema 2 renamed Confidence to Matching score, Selected master to Selected row, Merge suggestions to Values to review, merge to keep-one-row and keep-both to keep-all-rows. Schema 3 adds the final three metadata fields, keep-separate, raw-field omission summaries and removes certainty labels. Source columns now follow these new metadata fields; consumers must use column names and check the version.

Files without a version are legacy schema 1. Historical receipts are not rewritten. The app does not import audit files as executable instructions.
