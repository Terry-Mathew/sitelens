# ADR-0003: Use Neon PostgreSQL with Drizzle ORM

- **Date:** 2026-11-16
- **Status:** Proposed
- **Decided by:** pending founder approval (founder preference stated on 2026-11-16)

## Context and problem

v1 has no database. Scans live in the browser. SiteLens becomes a subscription SaaS with users, plans, subscriptions, scan allowances, scans, reports, and usage history. This data is relational. Allowance checks must be transactional, so that two parallel requests cannot use more scans than the plan allows.

## Options considered

1. **Neon PostgreSQL + Drizzle ORM.** Managed Postgres with branching, instant restore, and a built-in PgBouncer pooler. Drizzle gives typed queries and SQL migration files that a person can read.
2. **Cloud SQL for PostgreSQL.** Same region as Cloud Run. No scale to zero, so a fixed monthly cost. No managed auth.
3. **Firebase or Firestore.** A document database. Weak for joins, transactions over many rows, and reports. The founder excluded it.
4. **Prisma instead of Drizzle.** Mature, but adds a query engine and a schema language. Drizzle is smaller and closer to SQL.

## Decision and rationale

Option 1. Neon also hosts the managed authentication service (ADR-0004), and its user table lives in the same database. Application tables can then reference `neon_auth.user(id)` with a foreign key.

## Connection rules for Cloud Run

- The application uses the **pooled** connection string (host name contains `-pooler`). The pooler is PgBouncer in transaction mode and accepts up to 10,000 client connections.
- Use `pg` (node-postgres) with `drizzle-orm/node-postgres`. Cloud Run keeps a container alive between requests, so a small pool for each instance is correct. Set the pool to a maximum of 5 connections for each instance.
- Transaction mode allows normal `BEGIN ... COMMIT` transactions and `SELECT ... FOR UPDATE`. It does not keep session state. Do not use `SET` outside a transaction, SQL-level `PREPARE`, session advisory locks, or `LISTEN`.
- Migrations use the **direct** connection string (`DATABASE_URL_UNPOOLED`). Migrations through the pooler can fail.
- TLS: use `sslmode=verify-full` and `channel_binding=require`. Do not turn off certificate checks.
- Connection budget: maximum Cloud Run instances × 5 must stay far below the pooler limit. The direct limit (`max_connections`) depends on the compute size. Check it with `SHOW max_connections;`.

## Region

Neon has no region in India. The nearest Neon region is AWS Singapore (`aws-ap-southeast-1`). The Neon Azure regions are deprecated for new projects. Managed Better Auth runs only in AWS regions. Cloud Run must run near the database, because each scan makes several queries:

- If most users are in India or Asia: Neon `aws-ap-southeast-1` with Cloud Run `asia-southeast1` (Singapore).
- If most users are in the US or the UK: Neon `aws-us-east-1` with Cloud Run `us-east4`, or Neon `aws-eu-west-2` with Cloud Run `europe-west2`.

The founder must choose. The region of a Neon project cannot change after creation without a migration.

## Consequences and trade-offs

- New dependencies: `drizzle-orm`, `pg`, `drizzle-kit` (development only).
- All SQL and Drizzle calls stay in `lib/db/`. Other modules call functions from `lib/db/`.
- Neon scales to zero. The first query after an idle period is slower (cold start of the compute).
- Instant restore on the Free plan covers only 6 hours. The Launch plan allows up to 7 days. Production needs a paid plan. This is an approval gate (see ADR-0006).
- Database tests need a real Postgres: a service container in CI and a Neon development branch locally.

## Related files or components

- New: `lib/db/client.ts`, `lib/db/schema.ts`, `drizzle.config.ts`, `drizzle/` (migration files)
- `.env.example` (new variables `DATABASE_URL`, `DATABASE_URL_UNPOOLED`)
- `.github/workflows/ci.yml` (Postgres service for database tests)
