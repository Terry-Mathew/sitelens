# ADR-0005: Keep entitlements separate from authentication, and reserve scans in a transaction

- **Date:** 2026-11-16
- **Status:** Proposed
- **Decided by:** pending founder approval

## Context and problem

Each plan allows a number of scans in each billing period. A user can double-click, retry after a timeout, or open two tabs. Two parallel requests must not both use the last scan. A retried request must not use a second scan. A payment webhook that arrives twice must not change a subscription twice.

The founder requires that authentication stays separate from subscription entitlement checks.

## Options considered

1. **Check the plan inside the auth session.** Simple, but it mixes two jobs, and a session can keep an old plan for up to 5 minutes (ADR-0004).
2. **Count scans after the scan finishes.** No reservation. Two parallel requests can both pass the check, so a user can go over the allowance.
3. **A separate entitlements module that reserves a scan in a database transaction, with an idempotency key.** Correct under parallel requests and retries.
4. **A counter in Redis.** Fast, but the count is then in a different system from the subscription. The two can disagree.

## Decision and rationale

Option 3.

- `lib/auth/` answers one question: which user sent this request. It returns a user id or "no session". It knows nothing about plans.
- `lib/entitlements/` answers the other question: may this user do this action now. It takes a user id. It reads the subscription and usage from `lib/db/`.
- The route handler calls them in this order: session, then entitlement, then work.

### Scan reservation

1. The browser makes a new `Idempotency-Key` (a UUID) for each scan request. A retry uses the same key.
2. In one transaction, the server:
   - locks the active subscription row of the user (`SELECT ... FOR UPDATE`). This puts parallel requests of the same user in a queue.
   - looks for a usage event with the same user and key. If one exists, the request is a retry. The server returns the earlier result, or "still running".
   - counts the `reserved` and `consumed` scan events in the current period.
   - inserts a `reserved` usage event if the count is below the allowance. Otherwise it returns "allowance used".
3. The server runs the scan outside the transaction.
4. When the scan gives a result, the server stores the scan and changes the event to `consumed` in one transaction.
5. When SiteLens itself fails (an internal error), the server changes the event to `released`. A released scan does not count.
6. A scheduled job releases `reserved` events older than 15 minutes. These come from a crashed instance.

A unique index on `(user_id, kind, idempotency_key)` blocks a second event for the same key, even if the lock fails.

### Payments (billing milestone)

- Razorpay webhooks are the only source of subscription state. The return page in the browser is never trusted.
- The server checks the webhook signature first. Then it inserts the Razorpay event id into `billing_events` with `ON CONFLICT DO NOTHING`. A second delivery of the same event changes nothing.
- A user can have at most one subscription in the `pending` or `active` state (partial unique index). This prevents a second Razorpay subscription and a double charge.

### Rate limits

- The plan allowance replaces the daily global scan limit for signed-in users.
- A short burst limit stays (for example, scans in the last minute for each user). It uses the `usage_events` table, so Upstash is not needed for it.
- The PageSpeed request belongs to a stored scan of the same user. The server claims it once with `UPDATE scans SET pagespeed_claimed_at = now() WHERE id = $1 AND user_id = $2 AND pagespeed_claimed_at IS NULL`. This replaces the Redis performance ticket.
- **Upstash:** remove it when Neon Auth is confirmed to limit failed sign-in attempts (ADR-0004, item 1). If Neon Auth does not limit them, keep Upstash only for a sign-in limit by IP address.

## Consequences and trade-offs

- Each scan needs two short transactions. At the expected traffic, this cost is small.
- The `FOR UPDATE` lock queues only requests of the same user. Different users do not wait for each other.
- Concurrency tests need a real Postgres. An in-memory database with one connection cannot prove the lock.
- `lib/tickets.ts` and most of `lib/ratelimit.ts` are removed after the change.

## Related files or components

- New: `lib/entitlements/`, usage functions in `lib/db/`
- Changed: `app/api/scan/route.ts`, `app/api/pagespeed/route.ts`, `components/dashboard/ScanForm.tsx` (idempotency key)
- Removed later: `lib/tickets.ts`, most of `lib/ratelimit.ts`, `@upstash/*` (if item 1 of ADR-0004 is confirmed)
