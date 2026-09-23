# Local design review — 22 September 2026

Status: local preview only. Do not deploy or push until the user reviews the design.

## References inspected

- [Datablist](https://www.datablist.com/features/duplicates-remover): the opening screen pairs the task with product UI; later sections show actual review and merge decisions. Adopt the concrete explanation, not its broader feature claims.
- [Teamopipe Contact List Cleaner](https://www.teamopipe.com/en/tools/contact-list-cleaner): the CSV action appears immediately after a short explanation. Adopt the short path into the tool. Keep DedupeSafe's checker separate to preserve its isolated security policy.
- [Koalify](https://koalify.io/): HubSpot integration is visible in both headline and screenshots. DedupeSafe needs equally explicit scope: CSV review without modifying the portal. No borrowed testimonials, installation counts or competitor pricing.

These are observations of the vendors' own pages, not independently tested capability comparisons.

## Design choices

Replace the purple gradient, repeated rounded feature cards and long reassurance sections with a light, restrained document/workbench layout. Show an explicitly illustrative record comparison with reserved .example addresses. Link it to the working demo; do not present static controls as interactive.

Use the same typography, green action buttons, borders and file icon throughout the checker and legal pages. Keep matching, approval, audit and export behavior intact. Keep the email feedback link and its data-sharing warning.

## Local review

Run: npm.cmd run build
Then: npm.cmd exec vite -- preview --host 127.0.0.1 --port 4173 --strictPort

Review the homepage, upload screen, demo mapping and candidate groups, then approve a row and inspect the export confirmation. Campaign pages inherit the new layout.

Initial checks: build and lint passed; 86 unit tests and 4 browser scenarios passed. Landing, upload, mapping, results, privacy and consultant campaign pages had no document overflow at 320, 390 and 1440 px. Screenshots are local under the ignored test-results/design directory.

Existing social preview and demo media show the earlier design. Refresh those assets after visual approval, before publishing.

## Hierarchy and mobile refinement

The opening section is more compact, with a stronger headline and a quieter secondary action. On phones the primary action spans the content width. The sample switches to a field-by-field, two-record comparison; complete email values wrap inside the table. Review and footer controls have larger touch targets.

Verified at 320, 390, 768 and 1440 px: no page overflow, sample comparison fits its container. Build, lint and all 4 existing browser scenarios passed. No push or deployment.

## Decision-flow refinement

Added optional CSV preparation help linking to HubSpot's export documentation. Matching evidence now precedes the original values; comparison scores are secondary and explicitly not probabilities. Evidence for a connected group names the actual pair rather than implying that all rows match directly. Missing values are excluded from the explanation.

Moved group actions below the source values and added a removal/field-loss explanation beside them. Groups larger than two say Keep all rows. Mobile records show complete labeled values. Existing explicit audit and export confirmations remain intact.

Validation: build and lint passed, 89 unit tests and 4 browser scenarios passed. At 320, 390 and 1440 px, no page overflow or clipped candidate cells; approval flow passed. No deployment or push. This improves clarity; conversion or user task-completion gains have not been measured.

## Release authorization — 23 September 2026

The user reviewed the local work and explicitly authorized GitHub commits, push and production deployment on 23 September. The local-only status above records the earlier review phase; it is no longer a deployment restriction. See the release record for verified production status.
