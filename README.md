# SiteLens

SiteLens is a website review tool for freelancers and small agencies. You enter the homepage URL of a possible client. SiteLens finds problems that it can prove and makes a white-label PDF report that you can send to the business owner.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Firecrawl, Cheerio, Google PageSpeed Insights, Upstash Redis (rate-limit counters only), and `@react-pdf/renderer`. There is no database.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`. Set these values:
   - `SESSION_SECRET`: a long random string that signs the PageSpeed tickets. Make one with `openssl rand -hex 32`.
   - `FIRECRAWL_API_KEY`: optional. Without it, SiteLens loads the page with its own fetcher. The scan then shows the limitation "firecrawl_unavailable", and JavaScript-only content is not seen.
   - `PAGESPEED_API_KEY`: optional locally, required in production. Without it, Google limits requests and the performance panel shows "Performance data was unavailable at the time of the review." A key or quota problem shows the same neutral text, so it does not blame the client site.
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: optional locally. Without them, rate limits are off in development. SiteLens also accepts the Vercel KV names `KV_REST_API_URL` and `KV_REST_API_TOKEN`. In production (this includes Vercel Preview deployments), these values are required. When they are missing, scans and PageSpeed both stop with the message "The service is not available. Try again later." (HTTP 503).
3. Run `npm run dev` and open http://localhost:3000.

Never commit `.env.local`. Git ignores it.

Other scripts: `npm run test` (Vitest), `npm run lint` (ESLint), `npm run build` (production build).

## Access

SiteLens has no sign-in. The app opens directly on the scan page. Any person who can open the app can run scans. Do not put the app on the public internet before user sign-in exists (see `docs/architecture/decisions/0007-remove-shared-access-code.md`).

## Founder setup tasks

Do these steps yourself. Do not add a payment method to any service for v1.

1. **Vercel**: create an account and connect the repository. Do not deploy until you approve it.
2. **Upstash**: create a free Redis database. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If you connect Upstash through the Vercel Marketplace, Vercel can create `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead. SiteLens accepts both sets of names. Check the names in the Vercel dashboard.
3. **Google PageSpeed**: in Google Cloud, enable the PageSpeed Insights API. Create an API key and restrict it to that API. Set a daily quota cap on the key at 100 queries or more, because SiteLens allows up to 100 PageSpeed checks each day. Use it as `PAGESPEED_API_KEY`.
4. **Firecrawl**: create a free account (no payment method). Copy the key to `FIRECRAWL_API_KEY`.
5. **Ticket secret**: make a random `SESSION_SECRET`.
6. **Review the text**: read the "why it matters" and "how to fix" text for every check in `lib/content/` before you share the app.

## Privacy

- SiteLens sends the homepage URL that you enter to Firecrawl (page loading) and to Google PageSpeed Insights (performance test). It sends the URL to no other service.
- Scan results, report drafts, and branding stay in your browser (local storage). The server does not keep them and does not log scanned URLs or results.
- Upstash keeps only rate-limit counters, by IP address.
- Use "Clear all data" in the app header to delete all scans, drafts, and branding from the browser.

## Deploy (requires founder approval)

No deployment has been done. Do these steps only after the founder approves.

1. Make sure `npm run lint`, `npm run test`, and `npm run build` pass.
2. In Vercel, import the repository (or run `vercel` from the project folder).
3. In the Vercel project settings, set all variables from `.env.example` for the Production environment. Also set them for the Preview environment if you use Preview deployments. Without `SESSION_SECRET` and the Upstash values, scans do not work.
4. Deploy only after user sign-in exists. Open the site and check that a person who is not signed in cannot run a scan.
5. Scan one real homepage, check the dashboard, and export one PDF.
