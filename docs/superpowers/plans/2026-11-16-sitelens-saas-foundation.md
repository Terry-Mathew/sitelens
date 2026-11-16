# SiteLens SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Do not start.** This plan needs founder approval of ADR-0002 to ADR-0006 and of the open decisions in Section 9 of the spec. Task 0 lists the approvals.

**Goal:** Change SiteLens from an app with no sign-in and browser storage (ADR-0007 removed the shared access code) to user accounts, plans, scan allowances, and server-side scans on Neon PostgreSQL, ready to run on Google Cloud Run.

**Architecture:** Neon Managed Better Auth gives the user id (`lib/auth/`). A separate entitlements module (`lib/entitlements/`) reserves each scan in a Postgres transaction with an idempotency key. All SQL lives in `lib/db/` (Drizzle ORM, node-postgres, pooled connection). The scanner, checks, report logic, PDF, and SSRF guard do not change.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@neondatabase/auth`, `drizzle-orm` + `pg`, `drizzle-kit`, Vitest, Postgres 17 (CI service container), Google Cloud Run.

**Spec:** `docs/superpowers/specs/2026-11-16-sitelens-saas-foundation-design.md` (and the v1 PRD, whose rules stay in force). Decisions: `docs/architecture/decisions/0002` to `0006`.

## Global Constraints

- All v1 product rules, security rules, and logging rules in `CLAUDE.md` stay in force. A change that breaks one is a defect.
- Reuse `lib/security/`, `lib/gather/`, `lib/checks/`, `lib/performance/`, `lib/report/`, and `components/report/` without changes to their behavior.
- All SQL and Drizzle calls live in `lib/db/`. Each function that reads or writes user data takes `userId` as a required parameter.
- `lib/auth/` returns a user id only. `lib/entitlements/` takes a user id only. Neither imports the other.
- Never call Firecrawl, PageSpeed, or Razorpay inside a database transaction.
- Runtime database connection: pooled URL `DATABASE_URL`, `pg` Pool `max: 5`, TLS `sslmode=verify-full&channel_binding=require`. Migrations: `DATABASE_URL_UNPOOLED`.
- No session `SET`, SQL `PREPARE`, advisory locks, or `LISTEN` (the pooler is in transaction mode).
- Drizzle manages the `public` schema only. Never write a migration for `neon_auth`.
- `Idempotency-Key` header (UUID) is required on `POST /api/scan`. Missing or malformed: 400.
- Allowance used: HTTP 402 with the message "You have used all scans in your plan for this period."
- A scan of another user returns 404, never 403.
- Plan names, allowances, and prices come from the founder. Do not invent them. Tests use fixture plans.
- Tests live in `tests/`, in a folder that matches the source path. Database tests use the suffix `.db.test.ts`.
- TDD for `lib/db`, `lib/auth`, `lib/entitlements`, `proxy.ts`, and all API routes.
- New dependencies only: `@neondatabase/auth`, `drizzle-orm`, `pg`, `@types/pg` (dev), `drizzle-kit` (dev). Any other dependency needs an ADR.
- Pin each new dependency to a version that is at least two weeks old.
- Do not deploy, create an external account, or add a paid plan without founder approval.
- Before you write Next.js code, read the guide in `node_modules/next/dist/docs/`. Before you write auth code, read the current Neon Auth Next.js reference.
- All new text follows the Simplified Technical English rules in `AGENTS.md`.

## Review Focus

1. **Double click or retry with the same `Idempotency-Key`** → one usage event, and the same scan comes back. Test in Task 5 and Task 6.
2. **Two tabs race for the last scan in the period** → exactly the allowance is used. Test in Task 5.
3. **User B asks for the scan id of user A** → 404, and no data of user A. Test in Task 6 and Task 7.
4. **The scan crashes after the reservation** → the reservation is released and does not count. A reservation left by a crashed instance is released by the job after 15 minutes. Test in Task 5 and Task 8.
5. **Period boundary and subscription state** → scans of the previous period do not count. Only `active` subscriptions (the free plan included) allow new scans. `past_due` gives the 402 message with "payment" wording. Test in Task 5.

---

### Task 0: Founder approvals and Neon checks (no code)

- [ ] The founder approves or changes ADR-0002 to ADR-0006. Set each status to "Accepted" or edit it.
- [ ] The founder answers spec Section 9: region, plans, scan counting, retention, paid services, Upstash, test users.
- [ ] The founder creates a Neon project in the approved region and turns on Neon Auth. (External account: approval gate.)
- [ ] In that project, check and record in ADR-0004: (1) the sign-in attempt limit, (2) the shared email sending limit, (3) the exit path to self-hosted Better Auth, (4) the type of `neon_auth.user.id`.
- [ ] Record the answers in the ledger. If item (1) is "no limit", Task 8 keeps Upstash for sign-in.

### Task 1: Cloud Run readiness

**Files:**
- Modify: `lib/ratelimit.ts` (`getClientIp`), `next.config.ts`
- Create: `Dockerfile`, `.dockerignore`
- Test: `tests/ratelimit.test.ts`, `tests/security/` (IP tests)

**Interfaces:**
- Produces: `getClientIp(req: Request, mode?: "vercel" | "cloud-run"): string`. The mode comes from `CLIENT_IP_MODE` (default `"vercel"` to keep v1 behavior).

- [ ] **Step 1: Write the failing tests**
  - `getClientIp ignores x-real-ip in cloud-run mode`: headers `x-real-ip: 1.2.3.4`, `x-forwarded-for: 9.9.9.9` → `"9.9.9.9"`.
  - `getClientIp uses the right-most x-forwarded-for entry in cloud-run mode`: `"6.6.6.6, 9.9.9.9"` → `"9.9.9.9"`.
  - `getClientIp keeps v1 behavior in vercel mode`: `x-real-ip: 1.2.3.4` → `"1.2.3.4"`.
  - `blocks the GCP metadata address`: `isPrivateAddress("169.254.169.254") === true`.
- [ ] **Step 2:** Run `npx vitest run tests/ratelimit.test.ts tests/security`. Expect the cloud-run tests to fail.
- [ ] **Step 3:** Implement the mode in `getClientIp`. Add `output: "standalone"` to `next.config.ts`. Write a multi-stage `Dockerfile` (Node 22, `npm ci`, `npm run build`, run `.next/standalone/server.js` as a non-root user, `PORT` from env).
- [ ] **Step 4:** Run `npm run check` and `npm run build`. Expect all to pass. Run `docker build .` if Docker is available. Otherwise record that it was not run.
- [ ] **Step 5:** Commit: `feat: prepare SiteLens for Cloud Run`.

### Task 2: Database foundation

**Files:**
- Create: `lib/db/client.ts`, `lib/db/schema.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql` (generated), `drizzle/0001_scan_immutability.sql` (custom trigger), `tests/db/setup.ts`, `tests/db/neon-auth-stub.sql`
- Modify: `package.json`, `.env.example`, `.github/workflows/ci.yml`, `vitest.config.ts`
- Test: `tests/db/schema.db.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance), `withTransaction<T>(fn: (tx) => Promise<T>): Promise<T>`, and the tables in spec Section 4: `userProfiles`, `plans`, `subscriptions`, `scans`, `reports`, `usageEvents`.
- Database tests use the file suffix `.db.test.ts` and a third Vitest project `db` that runs only when `npm run test:db` is called. Exclude `*.db.test.ts` from the existing `node` project. CI runs it with a `postgres:17` service.

- [ ] **Step 1: Write the failing tests** in `tests/db/schema.db.test.ts`:
  - `rejects an update of scans.result`: insert a scan, then `UPDATE scans SET result = '{}'` → throws.
  - `allows the first pagespeed write and ignores a second`: the second `UPDATE ... WHERE pagespeed IS NULL` changes 0 rows.
  - `allows one open subscription per user`: a second `active` row for the same user → unique violation.
  - `rejects a second usage event with the same key`: same `(user_id, kind, idempotency_key)` → unique violation.
  - `cascades user deletion to profile, scans, and reports, and keeps usage events with a null user`.
- [ ] **Step 2:** Run `npm run test:db`. Expect failure because the tables do not exist.
- [ ] **Step 3:** Write the schema and the trigger. Generate the migration with `drizzle-kit generate`. Read the SQL. The test setup applies `tests/db/neon-auth-stub.sql`, then all migrations, to `TEST_DATABASE_URL`. If `TEST_DATABASE_URL` is missing, the setup throws "TEST_DATABASE_URL is not set".
- [ ] **Step 4:** Run `npm run test:db` and `npm run check`. Expect all to pass.
- [ ] **Step 5:** Add the `db-tests` job to CI with a `postgres:17` service. Commit: `feat: add the Postgres schema and migrations`.

### Task 3: Accounts with Neon Managed Better Auth

**Files:**
- Create: `lib/auth/server.ts`, `lib/auth/session.ts`, `app/api/auth/[...path]/route.ts`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `proxy.ts`, a sign-out button in `components/dashboard/AppHeader.tsx`
- Modify: `app/api/scan/route.ts`, `app/api/pagespeed/route.ts`, `components/dashboard/ScanForm.tsx` and `ScanDashboard.tsx` (send the user to `/sign-in` on 401), `.env.example`, `README.md`, `CLAUDE.md` (security rule 3)
- Test: `tests/auth/session.test.ts`, `tests/proxy.test.ts`, the route tests, the UI tests

ADR-0007 already removed the shared access code, `proxy.ts`, and the login and logout routes. This task adds sign-in to an app that has none.

**Interfaces:**
- Produces: `requireUser(req: Request): Promise<{ ok: true; userId: string } | { ok: false; response: Response }>`. Every route handler calls it first.
- Consumes: `auth.getSession()` from `createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: NEON_AUTH_COOKIE_SECRET } })`.

- [ ] **Step 1: Write the failing tests**
  - `requireUser returns 401 without a session` (mock `auth.getSession` → `{ data: null }`).
  - `requireUser returns the user id with a session`.
  - `each API route returns 401 without a session` (scan, pagespeed, and the new routes in later tasks).
  - `proxy sends a page request without a session to /sign-in`.
  - `POST routes reject a foreign Origin header with 403`.
- [ ] **Step 2:** Run the tests. Expect failure.
- [ ] **Step 3:** Implement with the Neon Auth Next.js SDK. Use the prebuilt auth UI only if it accepts SiteLens styling. Otherwise write two small forms with shadcn components.
- [ ] **Step 4:** Run `npm run check` and `npm run build`. Check the sign-in by hand against the Neon development branch.
- [ ] **Step 5:** Commit: `feat: add user accounts with Neon Auth`. Write the founder review summary (CLAUDE.md), because this is a security change.

### Task 4: Profile and free subscription on first sign-in

**Files:**
- Create: `lib/db/profiles.ts`, `lib/entitlements/ensure-profile.ts`
- Test: `tests/db/profiles.db.test.ts`

**Interfaces:**
- Produces: `ensureProfile(userId: string, now?: Date): Promise<void>`. It inserts the profile and a subscription on the fixture or seeded free plan, with `ON CONFLICT DO NOTHING`. Period: one month from `now`.

- [ ] **Step 1: Write the failing tests:** `creates one profile and one free subscription`, `is idempotent when called 10 times in parallel` (1 profile, 1 subscription).
- [ ] **Step 2:** Run `npm run test:db`. Expect failure.
- [ ] **Step 3:** Implement. Call `ensureProfile` from `requireUser`'s callers through the entitlements module, not from `lib/auth/`.
- [ ] **Step 4:** Run `npm run test:db` and `npm run check`.
- [ ] **Step 5:** Commit: `feat: create a profile and free plan on first sign-in`.

### Task 5: Entitlements and scan reservation

**Files:**
- Create: `lib/entitlements/index.ts`, `lib/db/usage.ts`
- Test: `tests/entitlements/entitlements.db.test.ts`

**Interfaces:**
- Produces:
  - `reserveScan(userId: string, key: string, now?: Date): Promise<ReserveResult>`, where `ReserveResult = { kind: "reserved"; reservationId: string } | { kind: "replay"; scanId: string | null } | { kind: "limit"; reason: "allowance" | "payment" | "no_plan" }`.
  - `completeScan(userId: string, reservationId: string, scan: ScanResult): Promise<void>`: stores the scan with `result_sha256` and sets the event to `consumed`, in one transaction.
  - `releaseScan(userId: string, reservationId: string): Promise<void>`.
  - `getUsage(userId: string, now?: Date): Promise<{ used: number; allowance: number; periodEnd: Date } | null>`.

- [ ] **Step 1: Write the failing tests** (fixture plan with 3 scans):
  - `20 parallel reservations with different keys give exactly 3 reservations and 17 allowance limits`.
  - `5 parallel reservations with the same key give one event`, and the others get `replay`.
  - `a released reservation does not count`.
  - `events of the previous period do not count`.
  - `past_due gives limit with reason payment`.
  - `completeScan stores the hash of the canonical result`.
- [ ] **Step 2:** Run `npm run test:db`. Expect failure.
- [ ] **Step 3:** Implement the algorithm in ADR-0005: lock the subscription with `FOR UPDATE`, look up the key, count `reserved` and `consumed` in the period, then insert.
- [ ] **Step 4:** Run `npm run test:db` 3 times to show that the concurrency tests are stable. Run `npm run check`.
- [ ] **Step 5:** Commit: `feat: reserve scans in a transaction with idempotency keys`.

### Task 6: Scan and PageSpeed routes on the database

**Files:**
- Modify: `app/api/scan/route.ts`, `app/api/pagespeed/route.ts`, `components/dashboard/ScanForm.tsx`, `lib/types.ts` (`ScanResponse`)
- Create: `lib/db/scans.ts`
- Delete: `lib/tickets.ts` and its tests
- Test: the route tests, `tests/db/scans.db.test.ts`

**Interfaces:**
- `POST /api/scan`: order is `requireUser` → Origin check → `Idempotency-Key` check → `normaliseAndValidateUrl` → `reserveScan` → `gather` + `runChecks` → `completeScan` (or `releaseScan` on error). Response: `{ scan: ScanResult }`.
- `POST /api/pagespeed` with `{ scanId }`: `requireUser` → `claimPageSpeed(userId, scanId)` (one-time `UPDATE ... RETURNING url`) → provider → `savePageSpeed(userId, scanId, outcome)` (write once).
- `ScanForm` makes one `crypto.randomUUID()` for each submit and reuses it on retry.

- [ ] **Step 1: Write the failing tests:** `returns 400 without Idempotency-Key`, `returns 402 when the allowance is used`, `returns the stored scan on replay without calling gather`, `releases the reservation when gather throws`, `pagespeed returns 404 for the scan of another user`, `pagespeed refuses a second claim with 409`, `never logs the URL` (spy on `console`).
- [ ] **Step 2:** Run the tests. Expect failure.
- [ ] **Step 3:** Implement. Keep the error mapping and the generic log message of v1.
- [ ] **Step 4:** Run `npm run check`, `npm run test:db`, and `npm run build`.
- [ ] **Step 5:** Commit: `feat: store scans and claim PageSpeed on the database`.

### Task 7: Dashboard and reports from the server

**Files:**
- Create: `app/api/scans/route.ts` (GET list), `app/api/scans/[id]/route.ts` (GET, DELETE), `app/api/reports/[scanId]/route.ts` (GET, PUT), `lib/db/reports.ts`
- Modify: `components/dashboard/RecentScans.tsx`, `components/dashboard/ScanDashboard.tsx`, `components/dashboard/ReportPanel.tsx`, `lib/storage.ts` (branding only), header "Clear all data" text
- Test: route tests, `tests/db/reports.db.test.ts`, the component tests that use storage

**Interfaces:**
- `PUT /api/reports/[scanId]` accepts only `{ excludedFindingIds: string[]; nextSteps: string; clientName: string }`. Unknown fields: 400. Finding ids must exist in the stored scan.
- `lib/report/` functions stay unchanged. They receive the scan from the server instead of from storage.

- [ ] **Step 1: Write the failing tests:** `GET /api/scans lists only the scans of the user`, `GET /api/scans/[id] returns 404 for another user`, `PUT report rejects evidence fields`, `PUT report rejects an unknown finding id`, `DELETE scan removes the scan and its report`.
- [ ] **Step 2:** Run the tests. Expect failure.
- [ ] **Step 3:** Implement. Use the existing loading and empty states of the dashboard.
- [ ] **Step 4:** Run `npm run check`, `npm run test:db`, and `npm run build`. Check the dashboard and one PDF export by hand.
- [ ] **Step 5:** Commit: `feat: load scans and reports from the account`.

### Task 8: Limits, retention job, and Upstash decision

**Files:**
- Modify: `lib/ratelimit.ts` (keep only what Task 0 decided), `package.json`
- Create: `scripts/retention.ts`, `lib/db/retention.ts`
- Test: `tests/db/retention.db.test.ts`, `tests/entitlements/burst.db.test.ts`

**Interfaces:**
- `runRetention(now: Date): Promise<{ releasedReservations: number; deletedScans: number; deletedUsageEvents: number }>` with the periods that the founder approved.
- Burst limit: at most 5 scans for each user in 1 minute (ruling, cheap to change), from `usage_events`.

- [ ] **Step 1: Write the failing tests:** `releases reservations older than 15 minutes`, `deletes scans older than the retention period and keeps newer scans`, `the sixth scan in one minute gets 429`.
- [ ] **Step 2:** Run the tests. Expect failure.
- [ ] **Step 3:** Implement. If Task 0 confirmed a Neon Auth sign-in limit, remove `@upstash/*` and the scan and PageSpeed Upstash limits. Otherwise keep Upstash only for sign-in.
- [ ] **Step 4:** Run `npm run check`, `npm run test:db`, `npm run build`, and `npm run quality:unused`.
- [ ] **Step 5:** Commit: `feat: add the retention job and per-user burst limit`.

### Task 9: Operations runbook (documents only, no deployment)

**Files:**
- Create: `docs/operations/database.md`, `docs/operations/cloud-run.md`
- Modify: `README.md` (setup, privacy), `.env.example`

- [ ] Write the migration procedure: generate, review, test on a Neon branch, apply with the direct URL, then deploy.
- [ ] Write the backup procedure: Neon restore window, scheduled snapshots, weekly `pg_dump` to Cloud Storage, and a restore test with a recorded time.
- [ ] Write the Cloud Run steps: Artifact Registry, Secret Manager names, region, maximum instances, `CLIENT_IP_MODE=cloud-run`, the Cloud Scheduler job for `scripts/retention.ts`, and the Neon Auth production checklist (trusted domain, own Google credentials, email verification on, custom SMTP, "Allow Localhost" off).
- [ ] Update the privacy text: scans and reports are stored in the account for the approved period.
- [ ] Run `npm run check` and `npm run build`. Commit: `docs: add database and Cloud Run runbooks`.

### Final review

Run the whole-branch review on the most capable model, with focus on the Review Focus list, the module boundaries, and the security table in spec Section 7. Then give the founder the review summary from `CLAUDE.md`. Do not deploy.
