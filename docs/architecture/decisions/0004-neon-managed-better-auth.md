# ADR-0004: Use Neon Managed Better Auth for user accounts

- **Date:** 2026-11-16
- **Status:** Proposed
- **Decided by:** pending founder approval

## Context and problem

v1 uses one shared access code and a signed session cookie (`lib/security/session.ts`). A subscription SaaS needs one account for each user, so that SiteLens can connect a user to a plan, a subscription, and usage. The founder prefers Neon Managed Better Auth, unless a concrete feature gap makes self-hosting necessary.

## SiteLens requirements

| Requirement | Managed Better Auth | Self-hosted Better Auth |
|---|---|---|
| Email and password sign-in | Yes | Yes |
| Google sign-in | Yes. Shared Google credentials for development. Own credentials required for production. | Yes |
| Email verification and password reset | Yes. Verification is off by default and must be turned on. Verification links need a custom email provider. Codes work with the shared provider. | Yes. We must build email sending. |
| Server check of the session in each route handler | Yes: `auth.getSession()` from `@neondatabase/auth/next/server` | Yes |
| Foreign key from our tables to the user | Yes: `neon_auth.user(id)`. Reference the primary key only. | Yes: our own table |
| Runs with Next.js on Cloud Run | Yes. The SDK is a Next.js route handler and middleware. The auth server is hosted by Neon. | Yes |
| Custom hooks on sign-up (for example, create a profile) | No custom hooks | Yes |
| Multi-factor authentication | Not available yet (on the Neon roadmap) | Yes, with a plugin |
| Teams with custom roles for agencies | Organization plugin on, but no custom roles and no teams | Yes |
| Cost | Included in all Neon plans. Free plan: up to 60,000 monthly active users for each project. | Free software. We run and maintain it. |
| Security maintenance | Neon runs and updates the auth server | We update Better Auth and own the security of the auth code |

## Options considered

1. **Neon Managed Better Auth.** No auth server to run. The user data is in our database. Limits: a fixed plugin set, no custom hooks, no MFA yet, AWS regions only, and no IP Allow or Private Networking on the Neon project.
2. **Self-hosted Better Auth.** Full control and all plugins. We own the auth endpoints, email sending, rate limits, and security updates.

## Decision and rationale

Option 1. No SiteLens requirement for the subscription milestone needs a missing feature:

- Instead of a sign-up hook, the application creates the profile row on the first authenticated request, with an idempotent `INSERT ... ON CONFLICT DO NOTHING`.
- MFA and agency teams are not in this milestone. If they become requirements, review this ADR.

## Items to verify before implementation

These items were not confirmed from the documentation during the research. Check each one in a Neon test project:

1. Does the managed service limit failed sign-in attempts for each IP address or each account? If not, SiteLens must keep its own login limit (see ADR-0005).
2. What is the sending limit of the shared email provider? The Neon documentation says only that production must use a custom provider.
3. Can a project move from managed to self-hosted Better Auth later without new passwords for users?

## Consequences and trade-offs

- The access code, `/api/login`, and the access-code session in `lib/security/session.ts` are removed after the change to accounts. This is a breaking change for current test users. Each user must create an account.
- New environment variables: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`.
- `getSession()` keeps session data in a signed cookie for 5 minutes (`sessionDataTtl` default 300). A revoked session can stay valid for up to 5 minutes. This is acceptable for SiteLens.
- Production needs a custom email provider (an SMTP service). That is a new external account. This is an approval gate.
- Production must turn on email verification, add the production domain as a trusted domain, use own Google credentials, and turn off "Allow Localhost".
- Authentication answers only "who is this user". It does not decide what the user may do. Entitlements are a separate module (ADR-0005).

## Related files or components

- New: `lib/auth/server.ts`, `lib/auth/session.ts`, `app/api/auth/[...path]/route.ts`, sign-in and sign-up pages
- Changed: `proxy.ts`, all route handlers in `app/api/`
- Removed later: `app/api/login/route.ts`, the access-code parts of `lib/security/session.ts`
