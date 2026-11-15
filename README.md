# SiteLens

Website audit app for freelancers (Next.js App Router, TypeScript, Tailwind, shadcn/ui).

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run test` - run Vitest
- `npm run lint` - run ESLint

## Setup

Nothing is deployed without founder approval. Do these steps yourself, in order:

1. **Vercel** - create a Vercel account/project for hosting (do not deploy until approved).
2. **Upstash** - create a free Upstash Redis database; copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. **Google PageSpeed** - in Google Cloud, enable the PageSpeed Insights API, create an API key, and set a daily quota cap on it. Use it as `PAGESPEED_API_KEY`.
4. **Firecrawl** - create a free Firecrawl account (no payment method required) and copy the key to `FIRECRAWL_API_KEY`. Optional: without it the app falls back to direct fetch.
5. **Access** - choose an `ACCESS_CODE` and generate a random `SESSION_SECRET` (e.g. `openssl rand -hex 32`).
6. Copy `.env.example` to `.env.local` and fill in the values; add the same variables in Vercel project settings.
