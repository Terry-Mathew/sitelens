# Architecture decisions

Each file records one decision. A "Proposed" decision is not approved. Do not implement it until the founder approves it. To add a decision, copy `ADR_TEMPLATE.md` and use the next number.

v1 decisions made before 2026-11-16 are in the PRD (`docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md`, Section 17). They do not have ADR files.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-host-on-google-cloud-run.md) | Host on Google Cloud Run instead of Vercel | Proposed |
| [0003](0003-neon-postgres-with-drizzle.md) | Neon PostgreSQL with Drizzle ORM | Proposed |
| [0004](0004-neon-managed-better-auth.md) | Neon Managed Better Auth for user accounts | Proposed |
| [0005](0005-entitlements-separate-from-auth.md) | Entitlements separate from auth, scans reserved in a transaction | Proposed |
| [0006](0006-server-side-scan-storage-retention-backups.md) | Scans stored on the server, with migrations, backups, and retention | Proposed |
| [0007](0007-remove-shared-access-code.md) | Remove the shared access code before user sign-in exists | Accepted |
