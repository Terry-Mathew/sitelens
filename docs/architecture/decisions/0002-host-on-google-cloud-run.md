# ADR-0002: Host the application on Google Cloud Run

- **Date:** 2026-11-16
- **Status:** Proposed
- **Decided by:** pending founder approval (founder preference stated on 2026-11-16)

## Context and problem

v1 was designed for Vercel (PRD Section 8). The founder now prefers Google Cloud Run, because SiteLens becomes a subscription SaaS. SiteLens needs a Node.js runtime: the SSRF guard in `lib/security/agent.ts` uses an undici Agent with a custom DNS lookup. The scan route can run for up to 60 seconds. The PageSpeed route can run for up to 90 seconds.

## Options considered

1. **Vercel (v1 plan).** No operations work and native Next.js support. The Hobby plan is not for commercial use. Function time limits depend on the plan.
2. **Google Cloud Run.** A container on Node.js. Request timeout up to 60 minutes. Scales to zero. Pay per use. More setup: a Dockerfile, Artifact Registry, Secret Manager, and a region choice.
3. **Cloudflare Workers.** Not possible without a rewrite of the SSRF guard, because Workers do not give the Node.js socket and DNS control that the guard needs.

## Decision and rationale

Option 2, if the founder approves. Cloud Run runs the existing Node.js code without changes to the scanner. Long scans fit inside its timeout. The same container can run locally and in CI.

## Consequences and trade-offs

- Next.js must build in `output: "standalone"` mode, and the repository needs a `Dockerfile`.
- **Security change required:** `getClientIp` in `lib/ratelimit.ts` trusts `x-real-ip` first. Vercel sets that header. Cloud Run does not set it and does not remove it, so a client can forge it and avoid the IP rate limit. The code must read the client IP in a mode for each platform before the first Cloud Run deployment.
- The GCP metadata server is at `169.254.169.254`. `lib/security/ip.ts` already blocks `169.254.0.0/16`. A regression test must keep this block, because the metadata server can give out service-account tokens.
- Secrets move to Google Secret Manager. Environment names stay the same.
- Set a maximum instance count. It limits cost and the number of database connections (see ADR-0003).
- Region choice: put Cloud Run in the same area as the Neon database (see ADR-0003). This is a founder decision.
- The founder must create a Google Cloud billing account. This is an approval gate.

## Related files or components

- `next.config.ts`, new `Dockerfile`
- `lib/ratelimit.ts` (`getClientIp`), `lib/security/ip.ts`
- `app/api/scan/route.ts`, `app/api/pagespeed/route.ts` (`maxDuration` values)
