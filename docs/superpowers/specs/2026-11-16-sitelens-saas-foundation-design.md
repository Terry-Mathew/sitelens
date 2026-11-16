# SiteLens SaaS foundation: accounts, database, and entitlements

- **Date:** 2026-11-16
- **Status:** Proposed. The founder must approve ADR-0002 to ADR-0006 and the open decisions in Section 9 before implementation starts.
- **Extends:** `docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md`. Section 18 of that PRD points here. All v1 product rules, security rules, and evidence rules stay in force.

## 1. Intent

SiteLens becomes a subscription SaaS. Each freelancer has an account, a plan, and a scan allowance for each billing period. Scans and reports are kept on the server, so a user can see them on any device. Billing with Razorpay is a later milestone. This milestone prepares the data model for it.

## 2. Goals, non-goals, anti-goals

**Goals**

- One account for each user (email and password, Google sign-in).
- Plans, subscriptions, and scan allowances in PostgreSQL.
- No double use of an allowance, also with parallel requests and retries.
- Authentication separate from entitlement checks.
- Migrations, backups, and data retention designed before production.
- Reuse of the existing scanner, checks, report logic, PDF, and SSRF guard without changes to their behavior.

**Non-goals for this milestone**

- Razorpay payments (the schema and rules are ready, Section 6).
- Agency teams, roles, and seats.
- Multi-factor authentication.
- A move of scans from the browser into the account.
- AI-generated text.

**Anti-goals (a failure even if it works)**

- A user can use more scans than the plan allows.
- A retried request uses two scans.
- A stored scan result or its evidence changes after the scan.
- User A can read the scans of user B.
- A scanned URL or a result appears in a server log.

## 3. Architecture

| Layer | Choice | ADR |
|---|---|---|
| Hosting | Google Cloud Run (Node.js container, `output: "standalone"`) | 0002 |
| Database | Neon PostgreSQL, pooled connection, node-postgres, Drizzle ORM | 0003 |
| Authentication | Neon Managed Better Auth (`@neondatabase/auth`) | 0004 |
| Entitlements | `lib/entitlements/`, transactional reservation with idempotency keys | 0005 |
| Scan storage, retention, backups | Scans and reports in Postgres, evidence locked by a trigger | 0006 |
| Website extraction | Firecrawl (unchanged), behind `lib/security/` | v1 |
| Performance | PageSpeed Insights, which includes CrUX field data (unchanged) | v1 |
| Billing (later) | Razorpay subscriptions, webhooks only | 0005 |

### Request flow for a scan

1. `proxy.ts` sends a visitor without a session to the sign-in page. This is a convenience only.
2. `app/api/scan/route.ts` calls `requireUser(req)` from `lib/auth/`. No user: 401.
3. The route validates the URL with `normaliseAndValidateUrl` from `lib/security/`. Invalid: 400.
4. The route calls `reserveScan(userId, idempotencyKey)` from `lib/entitlements/`. Allowance used: 402 with a plain message. Retry of a finished scan: 200 with the stored scan.
5. The route calls `gather()` and `runChecks()` (unchanged).
6. The route calls `completeScan(reservation, scanResult)`. It stores the frozen scan and marks the usage event `consumed` in one transaction.
7. On an internal error, the route calls `releaseScan(reservation)` and returns 500.

### Module boundaries

| Module | Job | Must not |
|---|---|---|
| `lib/auth/` | Read the session. Return the user id. | Read plans or usage. |
| `lib/entitlements/` | Decide if a user may scan. Reserve, complete, release. | Read cookies or headers. |
| `lib/db/` | All SQL and Drizzle calls. Each function that reads user data takes `userId` as a required parameter. | Contain business rules about plans. |
| `app/api/*` | Order of calls and HTTP status codes. | Contain SQL. |

## 4. Database schema (minimal)

Drizzle manages the `public` schema. Neon owns `neon_auth`. The type of `user_id` must match `neon_auth.user.id`. Check the type in a test project before the first migration.

### `user_profiles`

| Column | Type | Rule |
|---|---|---|
| `user_id` | same as `neon_auth.user.id` | Primary key. References `neon_auth.user(id)` ON DELETE CASCADE. |
| `agency_name` | text | Optional |
| `report_region` | text | `'uk'` or `'us'`. Default `'uk'`. |
| `created_at` | timestamptz | Default `now()` |

The application creates this row and a free subscription on the first authenticated request (`ensureProfile`, idempotent).

### `plans`

| Column | Type | Rule |
|---|---|---|
| `id` | text | Primary key, for example `'free'` |
| `name` | text | Shown to users |
| `scans_per_period` | integer | Greater than 0 |
| `price_minor` | integer | Price in the smallest currency unit. Null for the free plan. |
| `currency` | char(3) | For example `'INR'`. Null for the free plan. |
| `razorpay_plan_id` | text | Unique. Null until billing starts. |
| `is_active` | boolean | Default true |

The founder sets plan names, allowances, and prices. The code must not invent them. A migration seeds the values after the founder approves them.

### `subscriptions`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | user id type | References `user_profiles` ON DELETE SET NULL |
| `plan_id` | text | References `plans` |
| `status` | enum | `pending`, `active`, `past_due`, `cancelled`, `expired` |
| `current_period_start` | timestamptz | Not null |
| `current_period_end` | timestamptz | Not null. Greater than start. |
| `razorpay_subscription_id` | text | Unique. Null for the free plan. |
| `created_at`, `updated_at` | timestamptz | |

Partial unique index: one row for each `user_id` where `status` is `pending`, `active`, or `past_due`. This blocks a second paid subscription.

### `scans`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | Primary key. The same id as `ScanResult.id`. |
| `user_id` | user id type | References `user_profiles` ON DELETE CASCADE |
| `url`, `final_url` | text | |
| `scanned_at` | timestamptz | |
| `result` | jsonb | The frozen `ScanResult` |
| `result_sha256` | text | Hash of the canonical JSON of `result` |
| `pagespeed` | jsonb | Null until the PageSpeed result arrives. Written once. |
| `pagespeed_claimed_at` | timestamptz | Set once when the PageSpeed request starts |
| `created_at` | timestamptz | |

Index: `(user_id, created_at desc)`. Trigger: reject an `UPDATE` that changes `url`, `final_url`, `scanned_at`, `result`, or `result_sha256`.

### `reports`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | Primary key |
| `scan_id` | uuid | Unique. References `scans` ON DELETE CASCADE. |
| `user_id` | user id type | References `user_profiles` ON DELETE CASCADE |
| `excluded_finding_ids` | text[] | Ids of excluded findings only |
| `next_steps` | text | |
| `client_name` | text | |
| `updated_at` | timestamptz | |

Branding (name, logo, contact) stays in browser storage in this milestone.

### `usage_events`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | user id type | References `user_profiles` ON DELETE SET NULL |
| `subscription_id` | uuid | References `subscriptions` ON DELETE SET NULL |
| `kind` | enum | `scan` (the only value in this milestone) |
| `status` | enum | `reserved`, `consumed`, `released` |
| `idempotency_key` | text | From the `Idempotency-Key` request header |
| `scan_id` | uuid | References `scans` ON DELETE SET NULL. Set when consumed. |
| `created_at`, `settled_at` | timestamptz | |

Unique: `(user_id, kind, idempotency_key)`. Index: `(subscription_id, kind, created_at)`.

### `billing_events` (billing milestone, not in the first migration)

| Column | Type | Rule |
|---|---|---|
| `event_id` | text | Primary key. The Razorpay event id. |
| `event_type` | text | |
| `subscription_id` | uuid | Nullable |
| `received_at`, `processed_at` | timestamptz | |

## 5. Transactions and idempotency

The reservation algorithm is in ADR-0005. These rules apply to all database writes:

1. One transaction for each business step. Keep the transaction short. Never call Firecrawl, PageSpeed, or Razorpay inside a transaction.
2. Each write that a retry can repeat has a natural unique key: the idempotency key, the Razorpay event id, or the scan id.
3. Use `INSERT ... ON CONFLICT DO NOTHING RETURNING` to detect a repeat. Do not read and then insert.
4. Lock with `SELECT ... FOR UPDATE` on the subscription row only. Do not use advisory locks, because the pooler is in transaction mode.
5. A missing or malformed `Idempotency-Key` header is a 400 error on `/api/scan`.

## 6. Billing milestone rules (design only)

- Subscription state changes only after a verified Razorpay webhook. Check the HMAC signature with the webhook secret before any other step.
- Record each event id in `billing_events` first. A repeated event id stops processing.
- Create a Razorpay subscription only if the user has no `pending`, `active`, or `past_due` subscription.
- At the start of a new period, the webhook moves `current_period_start` and `current_period_end`. Usage counts only events inside the current period.
- Payment details never touch the SiteLens server. Razorpay Checkout collects them.

## 7. Security review of the design

| Risk | Control |
|---|---|
| User A reads or changes data of user B | Each `lib/db/` function for user data takes `userId` and filters by it. A test proves that user B gets "not found" for a scan of user A. |
| Spoofed client IP on Cloud Run | `getClientIp` gets a platform mode. On Cloud Run, it must not trust `x-real-ip`. Per-user limits replace most per-IP limits. |
| SSRF to the GCP metadata server | `169.254.0.0/16` stays blocked in `lib/security/ip.ts`. Add a named regression test for `169.254.169.254` and `metadata.google.internal`. |
| Change of evidence | Database trigger, write-once PageSpeed column, and no update function in `lib/db/` for these columns. |
| Database credentials | Secret Manager. A runtime role with data rights only (`SELECT`, `INSERT`, `UPDATE`, `DELETE` on `public`). A separate owner role runs migrations. |
| Database traffic | TLS with `sslmode=verify-full` and `channel_binding=require`. |
| Session revocation delay | Up to 5 minutes (`sessionDataTtl`). Accepted. |
| Brute-force sign-in | Verify the Neon Auth limit (ADR-0004, item 1). If there is none, add an IP limit on sign-in. |
| Cross-site request forgery | Better Auth cookies use `SameSite=strict` by default. Our POST routes also reject a request whose `Origin` header is not the app origin. |
| Logs | No URL, no result, no email address in server logs. Log the error name only (as in v1). |
| Webhook forgery (billing) | HMAC check before processing. Event id deduplication. |

## 8. Testing strategy

- **Unit tests (unchanged):** checks, gather, report logic, and the SSRF guard keep their existing tests.
- **Database integration tests:** run against a real Postgres from `TEST_DATABASE_URL`. CI uses a `postgres:17` service container. Locally, use a Neon development branch. The test setup creates a stub `neon_auth.user` table, because plain Postgres does not have the Neon schema. If `TEST_DATABASE_URL` is missing, the suite fails with a clear message. It does not pass silently.
- **Concurrency tests:** 20 parallel `reserveScan` calls with an allowance of 3 give exactly 3 reservations. 5 calls with the same key give one event.
- **Integrity tests:** an `UPDATE` of `scans.result` fails. A second PageSpeed write changes nothing.
- **Route tests:** each route returns 401 without a session. The auth module is mocked at the `requireUser` boundary.
- **Migration test:** CI applies all migrations to an empty database, then runs the database tests.

## 9. Open decisions for the founder

1. **Region.** Singapore (Neon `aws-ap-southeast-1` and Cloud Run `asia-southeast1`) if most users are in India or Asia. Otherwise US East or London. Neon has no region in India.
2. **Plans.** Names, scan allowance for each period, and prices. Should a free plan exist, and with how many scans?
3. **What counts as a scan.** Proposal: a scan counts when it returns a result, also with limitations. A SiteLens internal error does not count.
4. **Retention.** Proposal: scans and reports 12 months, usage events 24 months (ADR-0006).
5. **Paid services and new accounts (approval gates).** Google Cloud billing, Neon Launch plan (7-day restore), a custom email provider for auth emails, and a Cloud Storage bucket for the weekly dump.
6. **Upstash.** Proposal: remove it if Neon Auth limits failed sign-ins. Otherwise keep it for the sign-in limit only.
7. **Current test users.** ADR-0007 removed the access code, so the app has no sign-in until accounts exist. Existing browser scans stay in the browser and are not moved.

## 10. Left to the builder

- Exact Drizzle table definitions and index names.
- The canonical JSON method for `result_sha256` (sorted keys).
- The text of user messages, written in Simplified Technical English and reviewed by the founder.
