# SiteLens v1 — Product Requirements & Design

**Date:** 2026-11-15
**Status:** Final (founder decisions incorporated 2026-11-15)
**Stack:** Next.js (App Router) + TypeScript on Vercel · Tailwind CSS + shadcn/ui · Firecrawl + Cheerio · Google PageSpeed Insights · Upstash Redis (rate-limit counters only) · `@react-pdf/renderer` · no database

---

## 1. Intent and the why

SiteLens helps freelancers and small agencies **win paid website-improvement projects**. A freelancer enters a prospect's website URL, SiteLens finds real, verifiable problems, and the freelancer sends a polished, white-labelled PDF to the business owner as the opening of a sales conversation.

Because the report goes in front of a business owner as a sales tool, **credibility is the product**. One fabricated or wrong claim undermines the freelancer. Every design decision below favours "verifiable and honest about its limits" over "impressive".

Long-term business model: freelancers use SiteLens to generate leads, demonstrate expertise, and sell improvement services. v1 exists to prove the reports are useful for that.

## 2. Users

- **v1 users:** the founder plus a small number of freelancer friends. Not a public product.
- **Primary persona:** a freelance web designer/developer or small agency prospecting local and small businesses. Comfortable with websites, not necessarily an SEO specialist.
- **Report reader (not a user of the app):** a small-business owner. Non-technical, time-poor, cares about customers, leads, and trust, not tags and headers.

## 3. Primary user journey

1. Freelancer opens SiteLens and enters the shared access code (once per device; stays signed in for 30 days).
2. Freelancer enters a prospect's homepage URL and optionally the client business name.
3. SiteLens scans the homepage, `robots.txt`, `sitemap.xml`, and requests Google PageSpeed Insights data.
4. The **technical dashboard** shows every finding grouped by category, with severity, evidence, why it matters, and the recommended fix. HTML-based findings appear first; performance data fills in when PageSpeed returns.
5. Freelancer toggles each finding **Include / Exclude** for the client report (excluded findings stay visible and can be restored at any time before export).
6. Freelancer fills in optional branding (name, logo, email/website) and an optional **Recommended Next Steps** note.
7. A **live PDF preview** shows exactly what will be exported.
8. Freelancer exports the PDF and sends it to the business owner.

## 4. Goals, non-goals, anti-goals

### Goals (v1)
- Reliable, deterministic checks on the homepage, `robots.txt`, and `sitemap.xml`.
- Accurate PageSpeed Insights reporting with lab and field data clearly separated.
- A professional technical dashboard.
- A professional client PDF the freelancer would send without editing.
- Freelancer control over which findings appear in the PDF, plus a personal closing note.
- Deployed online for testing, protected by a shared access code, with cost controls.

### Non-goals (v1) — explicitly out of scope
- User accounts, sign-up, or a full authentication system.
- Payments, subscriptions, or billing.
- CRM integrations, lead tracking, email sending, project management.
- Persistent cloud storage of scans, reports, or branding.
- AI-generated text of any kind (deferred; see §11).
- Multi-page crawling, broken-link checking across the site, competitor comparison.
- Desktop PageSpeed run (mobile only in v1; see §7.3).
- Executing JavaScript on the scanned site (no headless browser).
- An invented overall "site score".
- Editing any evidence, measured value, or explanation text.

### Anti-goals — failure even if it technically works
- **Any fabricated number, issue, or business-impact claim** in the dashboard or PDF.
- Presenting heuristic UX/conversion/AI-readiness observations as definitive scores or guarantees.
- Reporting "no data" as "good" or "bad". Missing data is reported as missing.
- A PDF that looks amateurish or overly technical to a business owner.
- Surprise bills: anyone able to run unlimited scans on the founder's account.

## 5. Constraints

- **Founder is non-technical** and builds with Claude Code. Architecture must stay simple: one repo, one deployment, minimal services.
- **Stack (founder decision):** Next.js App Router + TypeScript on Vercel; Tailwind + shadcn/ui; Firecrawl + Cheerio; PageSpeed Insights; Upstash Redis; `@react-pdf/renderer`. No Python, FastAPI, Express, or extra backend services without a clear technical requirement.
- **No database.** The only server-side state is Upstash rate-limit counters (no scan data, keys expire within 24h).
- **Browsers cannot fetch other websites** (CORS), so all fetching happens in Next.js route handlers on the server.
- **Serverless functions are short-lived** and stateless, so rate limits need an external counter (Upstash).
- **The server fetches arbitrary user-supplied URLs**, so URL validation and SSRF protection are mandatory (see §8.3).
- **No paid services are added and nothing is deployed without founder approval.** Firecrawl, PageSpeed, Upstash, and Vercel are used on free tiers for v1.
- **The analysis engine is modular:** each check is an independent module registered in one list, so new checks can be added without touching others.
- **AI stays optional and separate** from deterministic analysis (none in v1; see §11).

## 6. Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **A. Next.js App Router on Vercel (UI + route handlers + proxy in one app)** | One repo, one deploy, free tier fits v1. Server-side access protection for pages and API in one place. Functions are stateless → Upstash for rate limits. | **Chosen (founder decision).** |
| B. Vite SPA + Vercel serverless functions | Also one deploy, but protecting the static app bundle needs extra routing work. | Superseded — Vite was never a fixed requirement. |
| C. SPA + separate Express/FastAPI server | In-memory rate limits possible, but two deployments and more to operate. | Rejected: no technical requirement justifies it. |

**Page fetching:**

| Approach | Trade-offs | Decision |
|---|---|---|
| **Hybrid: Firecrawl for the rendered homepage + own guarded fetcher for raw HTML, headers, redirects, robots.txt, sitemap, favicon, llms.txt** | Firecrawl runs a real browser (sees JavaScript-rendered content) and gets past more bot protection. The own fetcher supplies data Firecrawl doesn't return and the raw pre-JavaScript HTML needed for AI-readiness. Comparing both gives an accurate "needs JavaScript" check. | **Chosen.** |
| Own fetcher only | Free and simple, but blind to JavaScript-rendered content and blocked more often. | Kept as the automatic **fallback** when Firecrawl is unconfigured, out of credits, or errors. |
| Firecrawl only | No redirect chain, response headers, or raw HTML. | Rejected: several catalog checks need them. |

**PDF generation:**

| Approach | Trade-offs | Decision |
|---|---|---|
| **`@react-pdf/renderer` in the browser** | Same component renders the live preview and the export, so preview = output. No server cost. Supports PNG/JPG images only (not SVG). | **Chosen.** |
| Browser print-to-PDF with print CSS | Output varies by browser; page breaks hard to control. | Rejected. |
| Server-side headless Chrome | Heavy, slow, prone to serverless timeouts. | Rejected. |

## 7. What SiteLens measures

### 7.1 Principles
- Every finding is produced by a **deterministic check** with a stable `checkId`.
- Every finding carries **evidence**: the actual value observed (e.g. the title text and its length, the `Disallow` line from robots.txt, the count and filenames of images missing alt text).
- **"Why it matters" and "How to fix" text is pre-written per check**, reviewed once by the founder, and stored in the codebase. It is never generated per scan.
- Each check returns one of: `pass`, `fail`, `not_applicable`, or `unable_to_check` (with a reason). `unable_to_check` is never shown as a pass or a fail.

### 7.1a How each result type reaches the client PDF

| Result | Dashboard | Client PDF | Freelancer can toggle? |
|---|---|---|---|
| `fail` (Critical / Warning / Opportunity) | Findings list | Findings section | Yes — included by default |
| `fail` with Info severity (AI crawler access, `llms.txt`) | Findings list | Findings section, framed neutrally | Yes — **excluded** by default |
| `pass` | Passed list | "What's working well" | Yes — included by default; excluding removes it from that list |
| `unable_to_check` | "Couldn't check" list with reason | **"What we couldn't check"** section | **No — always shown** |
| `not_applicable` | Collapsed "Not applicable" list | Not shown | No |

`unable_to_check` items are always shown so that hiding them can't make "What's working well" read as though everything else passed (anti-goal: missing data is never presented as good or bad). *(Design call.)*

### 7.2 Severity levels
- **Critical** — stops the site being found or trusted (e.g. homepage set to `noindex`, robots.txt blocks all crawlers, no HTTPS).
- **Warning** — a clear, fixable problem that likely costs visibility or leads.
- **Opportunity** — a worthwhile improvement; not broken.
- **Info** — a neutral observation reported for context (e.g. which AI crawlers are allowed). No good/bad judgement.
- **Passed** — the check succeeded.

Each check has a fixed default severity defined in the check catalog.

### 7.3 Check catalog (v1)

The builder may adjust thresholds slightly with a code comment explaining why. Adding or removing checks is a scope change.

**Technical & SEO** (source: homepage HTML, HTTP response, robots.txt, sitemap.xml)

| Check | Fails when | Default severity |
|---|---|---|
| Site reachable | DNS does not resolve, connection refused, or homepage returns 404/410, or 5xx on two attempts. **401, 403, 429, timeouts, or a detected bot-protection/challenge page → `unable_to_check`** ("This site blocked our automated check"), never a fail. *(Design call: a block is not proof the site is down.)* When the homepage can't be read, all HTML-based checks return `unable_to_check`; PageSpeed still runs (Google fetches the page itself). *Amended 2026-11-16: connection refused, a TLS failure, a reset, a temporary DNS failure, or too many redirects → `unable_to_check`. Only a DNS name that does not exist, 404/410, or 5xx on two attempts is a fail, and only when no browser render or http:// answer shows that the site loads.* | Critical |
| HTTPS | Final URL is not HTTPS. *Amended 2026-11-16: SiteLens always scans the https:// address, also when the user types http://. A fail needs proof that https:// is absent: nothing answered on https:// and the http:// site works. A certificate problem on https:// → `unable_to_check`.* | Critical |
| HTTP → HTTPS redirect | `http://` version does not redirect to HTTPS | Warning |
| Redirect chain | More than 2 redirects to reach the homepage | Opportunity |
| Homepage indexable | `<meta name="robots">` or `X-Robots-Tag` contains `noindex` | Critical |
| robots.txt present | Reports present/absent (404). Unreachable → `unable_to_check` | Observation |
| robots.txt allows crawling | Blocks all user-agents from `/` | Critical |
| sitemap.xml present & valid | Missing, or not parseable XML (checks `/sitemap.xml` and any `Sitemap:` line in robots.txt). *Amended 2026-11-16: a plain-text list of URLs is valid. When no candidate is valid and one candidate could not be read, the result is `unable_to_check`.* | Warning |
| Title tag | Missing, or length outside 30–60 characters | Missing: Warning · Length: Opportunity |
| Meta description | Missing, or length outside 70–160 characters | Missing: Warning · Length: Opportunity |
| Single H1 | Zero H1s, or more than one | Warning |
| Canonical tag | Missing, or points to a different host | Opportunity |
| `lang` attribute | Missing on `<html>` | Opportunity |
| Mobile viewport | No `<meta name="viewport">` | Warning |
| Image alt text | Any `<img>` without an `alt` attribute (evidence: count + up to 10 filenames) | Warning |
| Open Graph tags | Missing `og:title` or `og:image` | Opportunity |
| Favicon | No icon link and `/favicon.ico` returns 404 | Opportunity |

**Content** (source: homepage HTML)

| Check | Fails when | Default severity |
|---|---|---|
| Visible text amount | Fewer than 250 words of visible text in the raw HTML | Warning |
| Outdated copyright year | A `©`/"copyright" year more than 1 year before the scan date | Opportunity |
| Heading structure | Heading levels skip (e.g. H1 → H3) | Opportunity |

**Conversion** (observations from homepage HTML; heuristic, labelled as such)

| Check | Fails when | Default severity |
|---|---|---|
| Contact method present | No `tel:` link, `mailto:` link, or `<form>` found (heuristic). *Amended 2026-11-16: these also count: a link to a contact page (path `contact`, `contact-us` or `get-in-touch`, or link text "Contact" / "Contact us"), an `sms:`, `wa.me` or `api.whatsapp.com` link, and an iframe from a known form service (for example Google Forms, Typeform, Jotform, HubSpot, Tally). A form counts only when it has a message box, a phone field, or an email field and a second text field. A search form or a one-field newsletter form does not count.* | Warning |
| Click-to-call link | No `tel:` link | Opportunity |
| Call-to-action present | No link/button whose text matches a list of action phrases (contact, call, book, quote, get started, buy, enquire, schedule, …) (heuristic) | Opportunity |
| Analytics detected | No known analytics/tag script (GA4, Google Tag Manager, Meta Pixel, Plausible, Fathom, Matomo). *Amended 2026-11-16: also Microsoft Clarity, Hotjar, HubSpot, Cloudflare Web Analytics and Segment. A Wix, Squarespace or Shopify site with no listed tool → `unable_to_check` ("This site uses {Platform}, which includes built-in visitor statistics."). The platform is never listed as a detected tool.* | Opportunity — framed as "we could not detect a way to measure visitors and leads" |

**AI search readiness** (signals only; no guarantee of AI citations)

| Check | Result | Default severity |
|---|---|---|
| AI crawler access | Reports, per crawler, allowed/blocked per robots.txt: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot | Observation (blocking may be a deliberate business choice) |
| Content readable without JavaScript | Raw HTML has little visible text but looks like a JavaScript app shell (most AI crawlers do not run JavaScript) | Warning |
| Structured data | No JSON-LD; or JSON-LD present but no `Organization` / `LocalBusiness` type | Opportunity |
| Machine-readable contact details | No phone number in a `tel:` link or JSON-LD `telephone`, **and/or** no address in JSON-LD `PostalAddress` or an `<address>` element. Reports which of phone/address were found. Wording: "We couldn't find your [address/phone] in a format search engines and AI tools can reliably read." It never claims the details are missing from the page. *(Design call: replaces free-text name/phone/address detection, which depends on country formats and risks false "your address isn't on your site" claims. No business name is required, so the result never depends on the editable client name.)* | Opportunity |
| `llms.txt` | Reports present/absent. Labelled as an emerging convention with no proven effect | Observation |

**Performance** (source: Google PageSpeed Insights API, **mobile** strategy only in v1)

- **Lab data (Lighthouse, simulated test):** Performance, Accessibility, Best Practices, SEO category scores; LCP, CLS, TBT, FCP, Speed Index. Always labelled "Google Lighthouse lab test (simulated mobile device)".
- **Field data (Chrome UX Report, real users, last 28 days):** LCP, INP, CLS at the 75th percentile with Google's good / needs improvement / poor rating. Labelled "Real-user data from Google". Report whether data is URL-level or origin-level. If absent: "Google does not have enough real-user data for this site." — never a substitute value.
- **Findings from performance:** Lab Performance score < 50 → Warning; field Core Web Vitals rated "poor" → Warning. Display values exactly as returned by Google, rounded only for display.
- If the PageSpeed request fails or times out, the performance section says "Performance data unavailable" with the reason, and the rest of the report is unaffected.

### 7.4 Which HTML each check reads
- **Rendered HTML (Firecrawl, JavaScript executed):** SEO tag, content, conversion, structured-data checks — this is what visitors and Google see.
- **Raw HTML (own fetcher, no JavaScript):** "Content readable without JavaScript" (compares raw vs rendered visible-text word counts), plus headers and redirect checks.
- **Fallback:** if Firecrawl is unavailable, rendered-HTML checks run on the raw HTML. If the raw HTML looks like a JavaScript app shell, show a dashboard banner and a PDF limitations note ("This site loads its content with JavaScript. Some content checks may be incomplete."), and text-dependent content/conversion checks return `unable_to_check` instead of `fail`.
- Every finding's evidence records its **source** (`rendered`, `raw`, `robots`, `sitemap`, `pagespeed`), shown in the technical view.
- The §7.5 limitation "JavaScript was not executed" is shown only when the fallback was used; otherwise it reads "The page was loaded in a browser; JavaScript was executed."

### 7.5 Scope and limitations statement (in every dashboard and PDF)
Every report includes a fixed "Scope & limitations" section covering:
- Only the homepage, `robots.txt`, and `sitemap.xml` were checked — not other pages.
- A point-in-time snapshot on the stated date.
- How the page was loaded: in a browser with JavaScript (Firecrawl), or raw HTML without JavaScript (fallback) — per §7.4.
- Lab performance is a simulated test; field data reflects real Chrome users when available.
- UX, conversion, and AI-readiness items are observations from the page code, not user testing, analytics, or guaranteed outcomes.
- SiteLens had no access to the site's analytics, search console, or business data.

## 8. Architecture

### 8.1 Shape
One Vercel project:

One Next.js (App Router) project on Vercel:

```
app/login/page.tsx            access-code form
app/(app)/page.tsx            URL entry + recent scans
app/(app)/scan/[id]/page.tsx  dashboard + report panel + live PDF preview (client component)
app/api/login/route.ts        verifies access code, sets signed session cookie
app/api/logout/route.ts       clears cookie
app/api/scan/route.ts         validates URL → gathers page data → runs check registry → ScanResult
app/api/pagespeed/route.ts    calls PageSpeed Insights (mobile) → normalised lab + field data
proxy.ts                      Next.js request proxy (named middleware.ts before Next 16): blocks every route without a valid session
lib/security/                 URL validation, SSRF-guarded fetch, session signing/verification
lib/ratelimit.ts              Upstash rate limiters
lib/gather/                   page-data gathering: firecrawl.ts, direct-fetch.ts, robots.ts, sitemap.ts → one PageData object
lib/checks/                   one file per check: pure (PageData) → Finding; registry.ts lists them all
lib/content/                  pre-written title / why-it-matters / how-to-fix text per checkId
lib/report/                   buildSummary, report-draft defaults (§7.1a), locale helpers
components/ui/                shadcn/ui
components/report/            @react-pdf/renderer document (shared by preview + export; client-only, loaded with dynamic import, ssr: false)
```

**Analysis engine flow:** `gather(url) → PageData` (all network I/O happens here) → `runChecks(PageData)` runs every check in `registry.ts` (pure functions, no I/O, isolated so one failing check returns `unable_to_check` without breaking the others) → `ScanResult`. Adding a check means adding one file, one registry entry, and one content entry.

The client calls `/api/scan` and `/api/pagespeed` **in parallel**, so slow PageSpeed responses never block the HTML findings. Route handlers run on the Node.js runtime (needed for DNS checks in the SSRF guard) and set `maxDuration`.

### 8.2 Access protection
- A single shared `ACCESS_CODE` environment variable.
- `/login` page posts the code to `/api/login`, which compares it in constant time and sets an `HttpOnly`, `Secure`, `SameSite=Lax` cookie containing an HMAC-signed token (secret: `SESSION_SECRET` env var) valid for 30 days.
- `proxy.ts` protects **all** routes (pages and `/api/*`) except `/login`, `/api/login`, and static assets; unauthenticated page requests redirect to `/login`, unauthenticated API requests get 401.
- Each route handler also verifies the cookie itself (defence in depth — the proxy is not the only check).
- Changing `ACCESS_CODE` or `SESSION_SECRET` in Vercel revokes access for everyone.
- Login attempts are rate-limited (see §8.4).

### 8.3 Safe fetching (SSRF protection)
Every user-supplied URL is validated **before** it is sent to Firecrawl, PageSpeed, or the own fetcher (reject non-http(s), credentials in URL, IP-literal private hosts, non-standard ports, hostnames resolving to private ranges). Firecrawl and PageSpeed fetch from their own infrastructure, but validation still applies so SiteLens never asks a third party to probe internal addresses. The own fetcher additionally must:
- Accept only `http:` and `https:` URLs on standard ports (80/443).
- Resolve the hostname and **reject private, loopback, link-local, and reserved IP ranges** (IPv4 and IPv6), re-checking on every redirect.
- Follow at most 5 redirects.
- Cap response bodies (homepage 5 MB, robots.txt 500 KB, sitemap 5 MB) and abort beyond the cap.
- Send an honest User-Agent in the standard crawler format, e.g. `Mozilla/5.0 (compatible; SiteLensBot/1.0)` — the same convention Googlebot uses. It passes many simple filters while still identifying SiteLens. SiteLens never impersonates a regular browser. *(Design call.)*

### 8.4 Cost controls
- **Rate limits** via `@upstash/ratelimit` (counters only, no scan data):
  - Scans: 10 per hour per IP, 100 per day global.
  - Login attempts: 10 per 15 minutes per IP.
  - Limits are config constants; the builder may tune them.
- **Timeouts:** Firecrawl scrape 30 s; own homepage fetch 10 s; robots.txt, sitemap, favicon, llms.txt 5 s each; PageSpeed 60 s. Set each route's `maxDuration` accordingly. A Firecrawl timeout falls back to raw HTML rather than failing the scan.
- **Firecrawl usage:** exactly one scrape per scan (homepage only, no crawl). Free-tier credits; no automatic paid upgrade.
- **Provider-side backstops (founder setup task):** daily quota cap on the PageSpeed API key in Google Cloud Console; stay on Firecrawl's free plan (or set a usage cap if upgrading later).
- When a limit is hit, the user sees a plain message ("Daily scan limit reached, try again tomorrow"), not an error page.

### 8.5 Data and persistence
- **No server storage.** Scan results return to the browser and are not logged.
- **Browser storage (`localStorage`):** branding settings (including the logo as a data URL, PNG/JPG, max 500 KB) and the **10 most recent scans**, including their Include/Exclude selections and Next Steps note, so a refresh or return visit doesn't lose work. A "Clear" action removes them. *(Builder note: this is the founder-approved "results live in the browser" decision; the 10-scan history is a design call, not a founder request.)*
- Scan results are **immutable** once returned: evidence and measured values cannot be edited anywhere in the UI. Only these freelancer-controlled fields are editable: per-finding Include/Exclude, Next Steps note, branding fields, client business name.

### 8.6 Data model (indicative)
```ts
type Severity = 'critical' | 'warning' | 'opportunity' | 'info' | 'passed';
type Category = 'technical-seo' | 'content' | 'conversion' | 'ai-readiness' | 'performance';

interface Finding {
  checkId: string;              // stable, maps to pre-written content
  category: Category;
  status: 'pass' | 'fail' | 'not_applicable' | 'unable_to_check';
  severity: Severity;
  evidence: Record<string, unknown>; // the actual observed values; read-only
  source: 'rendered' | 'raw' | 'headers' | 'robots' | 'sitemap' | 'pagespeed';
  unableReason?: string;
}

interface ScanResult {            // immutable after creation
  id: string;
  url: string; finalUrl: string;
  scannedAt: string;              // ISO timestamp
  findings: Finding[];
  pagespeed: PageSpeedResult | { unavailable: string };
  jsRendered: boolean;            // raw HTML looks like a JavaScript app shell
  loadedWith: 'firecrawl' | 'direct-fallback';
}

interface ReportDraft {           // freelancer-editable, stored alongside the scan
  scanId: string;
  includedCheckIds: string[];     // seeded from §7.1a defaults; unable_to_check items are not toggleable
  includePerformance: boolean;    // default true
  clientBusinessName?: string;
  nextSteps?: string;            // max ~1,500 characters
}
```

## 9. Dashboard (technical view)

- **Header:** scanned URL, final URL, scan date/time, JS-rendered banner if applicable.
- **Summary strip:** counts of Critical / Warning / Opportunity / Passed. No overall score.
- **Google Lighthouse scores** shown separately, labelled "Google Lighthouse (lab, mobile)". Field data panel beside it, labelled "Real-user data (Google)", or the "not enough data" message.
- **Findings list** grouped by category, sorted by severity. Each finding shows: title, severity badge, evidence (as observed), why it matters, how to fix, and an **Include in client report** toggle (defaults per §7.1a).
- **Passed**, **Couldn't check**, and **Not applicable** lists below the findings (per §7.1a).
- **Performance section toggle:** the whole performance section has its own Include toggle (included by default). When included, it shows Google's values exactly as returned, regardless of which individual performance findings are excluded. *(Design call: selection is allowed, editing is not.)*
- Excluded findings appear dimmed with a "Restore" action; never deleted.
- **Report panel:** branding fields, client business name, Next Steps note, and a **live PDF preview** that updates as toggles and fields change, plus an **Export PDF** button.
- **Scope & limitations** section at the bottom.

## 10. Client PDF report

Written for a non-technical business owner. Clean typography, generous whitespace. A **Report region** setting (UK / US, stored with branding, default UK) sets page size (A4 / Letter) and date format. Pre-written text uses one spelling set, written to read naturally in both (avoiding region-specific words where possible). *(Design call — the founder did not specify prospects' region.)*

1. **Cover:** "Website Review for {client business name or domain}", the domain, generation date, and — if provided — the freelancer's logo, name, and email/website. Without branding, a neutral cover with no SiteLens marketing.
2. **Summary (deterministic):** a templated paragraph built only from included findings, e.g. "We reviewed the homepage of example.com on 15 November 2026 and found 2 critical issues and 4 warnings. The most important are: …" listing the top 3 by severity. No AI.
3. **Findings:** only included findings, ordered by severity. Each shows a plain-language title, severity, **what we found** (the original evidence, simplified for readability but not altered), **why it matters** (pre-written business-impact text), and **recommended fix**.
4. **Performance** (if the section is included): Lighthouse lab scores and field data, each clearly labelled, or the unavailable/no-data message.
5. **What's working well:** included passed checks (gives a balanced, credible tone).
6. **What we couldn't check:** every `unable_to_check` item with its plain-language reason. Omitted only when there are none.
7. **Recommended next steps:** the freelancer's note, if provided, with their contact details.
8. **Scope & limitations:** the fixed statement from §7.5.

The deterministic summary counts only included failed findings, and adds "N items couldn't be checked automatically" when N > 0.

Footer on every page: page number and generation date. The PDF preview and the exported file come from the same component, so they always match.

## 11. Future AI hook (not built in v1)
v1 generates the summary deterministically. The summary is produced by one function (`buildSummary(scan, draft) → string`) so an optional AI version can replace it later. Any future AI step must receive only the included findings and their evidence, and must not introduce issues, numbers, or impact claims not present in that input.

## 12. Quality and testing
- Every check is a pure function with **unit tests against fixture HTML/robots/sitemap files**, covering pass, fail, and unable-to-check cases (Vitest).
- PageSpeed normalisation is tested against saved real API responses, including one with no field data and one error response.
- Gathering is tested with mocked Firecrawl and fetch responses, including Firecrawl failure → raw-HTML fallback, and blocked (403/challenge) homepages.
- Session signing, the access-protection proxy, and rate-limit responses have tests.
- SSRF guard has explicit tests for private IPs, `localhost`, IPv6 loopback, and redirect-to-private.
- Manual acceptance: scan 5–10 real small-business sites (including one Wix/Squarespace site and one JavaScript-heavy site) and review each PDF as if sending it.

## 13. Acceptance criteria (v1 is done when)
- Unauthenticated users cannot load the app or call any `/api` endpoint.
- Scanning a real homepage returns findings for every catalog check (pass/fail/unable) within ~15 s; performance data appears within ~60 s or shows "unavailable".
- Every finding displays real evidence; no numbers appear that did not come from the scan or Google.
- Lab and field performance data are visibly distinct; missing field data is reported as missing.
- Include/Exclude, restore, branding, and Next Steps all update the live preview, and the export matches the preview.
- Evidence and measured values are not editable anywhere.
- Rate limits and timeouts trigger friendly messages.
- Every dashboard and PDF includes the scope & limitations section.
- The founder would send the PDF to a real business owner unedited.

## 14. Founder setup tasks (non-code)
- Create a Vercel account and connect the repo.
- Create a free Upstash Redis database; add its REST URL/token to Vercel env vars.
- Create a Google Cloud project, enable PageSpeed Insights API, create an API key, restrict it to that API, and set a daily quota cap.
- Create a free Firecrawl account and API key (free plan; do not add a payment method for v1).
- Approve the first deployment explicitly — nothing is deployed automatically.
- Choose `ACCESS_CODE` and generate a random `SESSION_SECRET`.
- Review the pre-written "why it matters" / "how to fix" text for every check before sharing with friends.

## 15. Left to the builder
- Exact visual design of the dashboard and PDF, within the "professional enough to send to a business owner" bar.
- Minor threshold tuning, with comments.
- Exact wording of pre-written explanations (founder reviews before testers use it).

## 16. Development workflow
- Built with Claude Code using installed skills: planning (`superpowers:writing-plans`), UI (`frontend-design`), implementation (`superpowers:subagent-driven-development` or `superpowers:executing-plans`), testing (`superpowers:test-driven-development`), and review (`superpowers:requesting-code-review`, `superpowers:verification-before-completion`).
- Verify current library APIs (Next.js proxy/middleware naming, Firecrawl scrape response fields, `@react-pdf/renderer` with Next.js) against up-to-date docs at implementation time.

## 17. Founder review corrections (2026-11-15) — these override earlier sections where they conflict

1. **SSRF, connection-time validation.** The own fetcher uses an `undici` `Agent` whose `connect.lookup` resolves the hostname, rejects the connection if **any** resolved address is private/reserved, and connects only to the validated address. Because validation happens inside the connection step, DNS rebinding (public at check time, private at connect time) is blocked. IP-literal hosts (which skip DNS lookup) are validated explicitly before connecting. Every redirect hop goes through the same agent and validation. Regression tests cover rebinding, redirect-to-private, IP literals (v4, v6, IPv4-mapped IPv6), and decimal/octal/hex IP encodings. DNS rebinding is **not** an accepted risk.
2. **Quotas on both cost endpoints.** `/api/scan` and `/api/pagespeed` each have per-IP and global daily limits. In addition, `/api/pagespeed` requires a **single-use performance ticket** issued by `/api/scan` (HMAC-signed `{scanId, url, exp: 10 min}`; first use recorded in Upstash with `SET NX` + expiry). So PageSpeed can only run once per counted scan, for the scanned URL. Limits: scan 10/h/IP, 100/day global; pagespeed 10/h/IP, 100/day global; login 10/15 min/IP.
3. **Severity discipline.** Each check declares `confidence: 'verified' | 'heuristic'`. **Critical is reserved for strong, verified evidence of a serious problem**: site unreachable (DNS failure, 404/410, repeated 5xx), homepage `noindex`, robots.txt disallowing all crawlers from `/`, final URL not HTTPS. Heuristic checks (contact method, call-to-action, analytics, word count, business details) are never Critical and are worded as observations ("We could not find…"), never as definite failures. Metadata length issues are Opportunity. Missing robots.txt is an Observation.
4. **Observations are separate from failures.** A fifth status `observation` exists for neutral facts (AI crawler access, `llms.txt`, robots.txt presence). Observations never count as issues, never appear in severity counts or the summary's issue count, and appear in their own "Observations" list (dashboard) and optional "Observations" section in the PDF (excluded by default).
5. **Exclusion never changes results or misleads.** Exclusion lives only in `ReportDraft`; `ScanResult` is frozen and never mutated. The PDF summary describes **what this report includes** ("This report highlights N issues selected for review…"), never "we found no issues" when failed findings were excluded. "What's working well" lists only checks that passed — never excluded items. When any failed finding is excluded, the scope section adds: "This report presents a selection of findings from the review."
6. **Performance provider interface.** Performance data comes through `PerformanceProvider { id; fetch(url): Promise<PerformanceOutcome> }`, with Google PageSpeed as the only v1 implementation. The rest of the app uses only SiteLens's own normalised `PerformanceResult` type. Field data is optional; every PageSpeed field is parsed defensively (unknown shape → `unavailable`, never a crash or a guessed value).
7. **Privacy and browser storage.** Browser storage holds only scan results, report drafts, and branding. Never the access code, session token, or any credential (the session cookie is `HttpOnly` and not readable by scripts). A **Clear all data** action (header) and per-scan **Delete** are provided. The server does not log scanned URLs or results. The app loads no third-party analytics. The UI notes that scanned URLs are sent to Firecrawl and Google for analysis.
8. **Limitations, not false findings.** Gathering produces a `limitations` list (`firecrawl_unavailable`, `homepage_blocked`, `homepage_unreachable`, `non_html`, `too_large`, `js_fallback`, `robots_unavailable`, `sitemap_unavailable`) and the client adds `performance_unavailable` / `field_data_unavailable`. Each maps to fixed plain-language text shown in the dashboard and the PDF scope section. Checks whose input is missing return `unable_to_check`, never `fail`.

## 18. SaaS foundation (2026-11-16, proposed)

The founder decided on 2026-11-16 that SiteLens becomes a subscription SaaS. The design is in `docs/superpowers/specs/2026-11-16-sitelens-saas-foundation-design.md`. The decisions are in ADR-0002 to ADR-0006 in `docs/architecture/decisions/`. Their status is "Proposed". When the founder approves them, they override these parts of this PRD:

- Section 5 and Section 8: hosting changes from Vercel to Google Cloud Run. A PostgreSQL database (Neon) is added.
- Section 4 (non-goals) and Section 17, item 7: accounts, plans, subscriptions, and server-side storage of scans and reports are added. Billing with Razorpay is a later milestone.
- Section 17, item 2: per-user plan allowances replace the global daily scan limit. The Redis performance ticket is replaced by a one-time claim on the stored scan.
- The shared access code is replaced by one account for each user (Neon Managed Better Auth).

All product rules, evidence rules, SSRF rules, and logging rules in this PRD stay in force.
