# ADR-0007: Remove the shared access code before user sign-in exists

- **Date:** 2026-11-16
- **Status:** Accepted
- **Decided by:** founder, in the chat on 2026-11-16

## Context and problem

In v1, each person typed one shared access code to enter the app (PRD Section 8.2). A signed cookie then kept the person signed in for 30 days. The proxy and each API route checked that cookie.

The founder will add user sign-in and payments (ADR-0004, ADR-0005) and then publish the app on the internet. The founder said that the access code is not necessary until then.

The access code had two jobs:

1. It kept strangers out of the app.
2. It protected the Firecrawl credits and the Google PageSpeed quota, because only people with the code could start a scan.

## Options considered

1. **Remove the access code now.** The app opens directly on the scan page. Less code to keep. While the app runs only on a local computer, there is no risk. On the internet, any person can start scans.
2. **Keep the code, but make it optional with a setting.** No login when the setting is empty. This keeps code that sign-in will replace soon, and it adds a second mode to test.
3. **Keep the access code until sign-in replaces it.** No risk, but the founder does not want it.

## Decision and rationale

Option 1. The founder chose it. The app is not deployed. User sign-in (ADR-0004) replaces the access code before the app goes on the public internet.

## Consequences and trade-offs

- These files are deleted: `proxy.ts`, `lib/security/session.ts`, `app/login/page.tsx`, `app/api/login/route.ts`, `app/api/logout/route.ts`, and their tests.
- The "Log out" button is removed. The scan routes no longer return 401.
- The login rate limiter (`checkLoginLimit`) is removed.
- `ACCESS_CODE` is no longer used. `SESSION_SECRET` stays, because it signs the PageSpeed tickets (`lib/tickets.ts`).
- The rate limits for each visitor and for each day are now the only protection against misuse. On Cloud Run the visitor address must come from a header that Google sets (ADR-0002). Without the access code, this fix is more important.
- **Rule:** do not deploy the app to the public internet before user sign-in exists. This rule is in `CLAUDE.md`, security rule 3.
- The SaaS plan, Task 3, now adds sign-in. It no longer has an access code to remove.

## Related files or components

- `app/api/scan/route.ts`, `app/api/pagespeed/route.ts`
- `components/dashboard/AppHeader.tsx`, `components/dashboard/ScanForm.tsx`, `components/dashboard/ScanDashboard.tsx`
- `lib/ratelimit.ts`
- `CLAUDE.md`, `README.md`, `.env.example`
