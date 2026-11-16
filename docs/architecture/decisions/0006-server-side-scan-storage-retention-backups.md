# ADR-0006: Store scans on the server, with migrations, backups, and data retention

- **Date:** 2026-11-16
- **Status:** Proposed
- **Decided by:** pending founder approval

## Context and problem

In v1 the server keeps no scan data. Scans, report drafts, and branding stay in the browser (PRD Section 17, item 7, and the privacy section of `README.md`). The founder now lists scans, reports, and usage history as data of the SaaS. This changes the privacy promise. It also needs rules for migrations, backups, and how long SiteLens keeps data.

## Options considered

1. **Keep scans in the browser. Store only usage counts.** Best privacy. But a user loses scans on a new device, and the server cannot prove which scan used an allowance.
2. **Store scans and reports on the server, with a fixed retention period.** Scans work on all devices. The usage history can point to the scan.
3. **Store scans on the server forever.** More risk and more cost, with no clear user benefit.

## Decision and rationale

Option 2.

### Evidence integrity in the database

- The `scans.result` column holds the frozen `ScanResult` as JSONB. `scans.result_sha256` holds a hash of it.
- A database trigger rejects an `UPDATE` of `url`, `final_url`, `scanned_at`, `result`, or `result_sha256`. The application cannot change evidence, even by mistake.
- PageSpeed data is written once: `UPDATE ... WHERE pagespeed IS NULL`.
- Report drafts live in `reports`. A draft holds only the ids of excluded findings, the next steps text, and the client details. A draft never holds a copy of evidence.

### Privacy rules that stay

- The server still does not write scanned URLs or results to logs.
- Browser storage keeps only branding and drafts that are not saved yet. It never keeps a session token or a credential.

### Retention (proposal for founder approval)

| Data | Kept for | Then |
|---|---|---|
| Scans and reports | 12 months after creation, or until the user deletes them | Deleted |
| Usage events | 24 months | Deleted |
| Billing events and subscriptions | As long as tax law requires. Confirm with an accountant. | Deleted or kept without personal data |
| Account and profile | Until the user deletes the account | Cascade delete of profile, scans, and reports. Usage and billing rows keep no name or email. |

A daily job (Cloud Scheduler starts a Cloud Run job) deletes expired rows.

### Migrations

- `drizzle-kit generate` writes SQL migration files to `drizzle/`. A person reviews each file in the pull request. Commit every file.
- Apply migrations with `drizzle-kit migrate` and the direct connection, as a separate step before the new version starts. The application does not migrate at start-up.
- Test each migration first on a Neon branch made from production.
- Migrations go forward only. For a breaking change, use expand and contract: add the new column, deploy code that writes both, move the data, then remove the old column in a later release.
- Drizzle manages only the `public` schema. Neon owns the `neon_auth` schema. Drizzle must not change it.

### Backups

- Neon instant restore: the Free plan covers 6 hours only. The Launch plan allows up to 7 days. The Scale plan allows up to 30 days. Production must use at least Launch with a 7-day window.
- Scheduled Neon snapshots (paid plans): daily, kept for the period that the founder approves.
- An independent copy: a weekly `pg_dump` of the `public` schema to a Google Cloud Storage bucket with a lifecycle rule. This protects against loss of the Neon account.
- Before launch, do one restore test into a new branch. Record the time it took.

## Consequences and trade-offs

- The privacy text in `README.md` and in the app must change before launch.
- A paid Neon plan and a Cloud Storage bucket are paid services. These are approval gates.
- Users get scans on all devices. Existing scans in a browser are not moved to the server automatically.

## Related files or components

- New: `lib/db/schema.ts` (`scans`, `reports`), `drizzle/` migrations, retention job script
- Changed: `lib/storage.ts`, `components/dashboard/*`, `README.md` (privacy section)
