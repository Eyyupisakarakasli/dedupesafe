# HubSpot Duplicate Contact Checker

Upload your HubSpot contact CSV. Find duplicates that exact-match tools miss.

👉 **[hubspot-dup-checker.vercel.app](https://hubspot-dup-checker.vercel.app)**

## What it does

HubSpot's native dedupe only catches exact email matches. This tool uses fuzzy matching across 5 fields to find real duplicates:

| Field | Method |
|-------|--------|
| Email | Exact + same-domain fuzzy (john@acme.com ≈ john.smith@acme.com) |
| Phone | Digits-only, last-8-digit suffix match |
| Name | Jaro-Winkler similarity (Jon ≈ John, Smith ≈ Smyth) |
| Company | Suffix-stripped comparison (Acme Corp = ACME Corporation) |

## Privacy

Everything runs locally in your browser. No upload, no server, no analytics, no tracking. Your contact data never leaves your device.

## Usage

1. Export contacts from HubSpot as CSV
2. Drop the CSV onto the page
3. Review duplicate groups and merge suggestions
4. Download the cleaned CSV

## Tech

- Vite + React + TypeScript
- Client-side CSV parsing (PapaParse)
- Jaro-Winkler fuzzy string matching
- Union-Find transitive grouping
- Deployed on Vercel
