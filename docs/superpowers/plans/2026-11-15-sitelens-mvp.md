# SiteLens v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared-code-protected Next.js app where a freelancer scans a prospect's homepage, reviews evidence-based findings in a dashboard, selects which go into a white-labelled client PDF, previews it live, and exports it.

**Architecture:** One Next.js App Router project on Vercel. Route handlers do all network I/O (`gather(url) → PageData`), then a registry of pure check modules turns `PageData` into `Finding[]`. PageSpeed runs in a separate route in parallel. Results, drafts, and branding live only in browser `localStorage`; the PDF is rendered client-side with `@react-pdf/renderer` from the same component used for preview.

**Tech Stack:** Next.js (App Router, latest stable) · TypeScript (strict) · Tailwind CSS · shadcn/ui · Cheerio · Firecrawl JS SDK (`@mendable/firecrawl-js`) · Google PageSpeed Insights v5 API · `@upstash/ratelimit` + `@upstash/redis` · `@react-pdf/renderer` · Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md` (read it before starting any task; section numbers below refer to it)

## Global Constraints

- No database, no accounts, no payments, no CRM, no AI in v1. No Python/FastAPI/Express.
- No server-side storage of scan data; Upstash holds rate-limit counters only.
- Never fabricate: every displayed number or issue comes from `PageData`, PageSpeed, or pre-written content. Missing data is shown as missing ("not available"), never as pass/fail.
- Evidence and measured values are read-only everywhere in the UI. Editable fields only: per-finding include, `includePerformance`, branding, client business name, next steps, report region.
- No invented overall site score. Lighthouse scores labelled "Google Lighthouse (lab, mobile)"; field data labelled "Real-user data (Google)".
- Route handlers: `export const runtime = 'nodejs'`; set `maxDuration` (scan 60, pagespeed 90).
- Timeouts: Firecrawl 30 s; direct homepage 10 s; robots/sitemap/favicon/llms.txt 5 s each; PageSpeed 60 s.
- Body caps: homepage 5 MB, robots.txt 500 KB, sitemap 5 MB. Max 5 redirects.
- User-Agent for own fetcher: `Mozilla/5.0 (compatible; SiteLensBot/1.0)`.
- Rate limits: scan 10/h/IP + 100/day global; pagespeed 10/h/IP + 100/day global, plus a single-use performance ticket from `/api/scan`; login 10/15 min/IP (spec §17.2).
- Spec §17 (founder review corrections) overrides earlier spec sections where they conflict. Read it first.
- Critical only for verified serious problems (spec §17.3); heuristic checks never Critical. Observations use status `observation` and never count as issues (§17.4).
- `ScanResult` is frozen; exclusion lives only in `ReportDraft` (§17.5).
- Browser storage never holds the access code, session token, or credentials (§17.7).
- TDD (test first, watch it fail) is mandatory for all scanner (`lib/gather`, `lib/checks`, `lib/performance`) and security (`lib/security`, `lib/ratelimit`, `lib/tickets`, proxy, API routes) code.
- Session cookie: name `sitelens_session`, `HttpOnly`, `Secure` (prod), `SameSite=Lax`, 30-day expiry, HMAC-SHA256 signed with `SESSION_SECRET`.
- Env vars: `ACCESS_CODE`, `SESSION_SECRET`, `FIRECRAWL_API_KEY` (optional → fallback), `PAGESPEED_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- `localStorage`: max 10 scans; logo PNG/JPG ≤ 500 KB.
- Do not deploy or add paid plans without explicit founder approval.
- Verify current APIs with up-to-date docs (context7 / official docs) for: Next.js `proxy.ts` vs `middleware.ts`, Firecrawl scrape response fields, `@react-pdf/renderer` in Next.js, shadcn/ui init.
- Plain-language copy in the client view; neutral spelling across UK/US.

## Review Focus

1. **URL typed without scheme or with extra bits** (`example.com`, ` Example.com/about?x=1 `) → normalised to `https://example.com/` (homepage). Test in Task 3.
2. **Homepage returns non-HTML or oversized content** (PDF, image, 20 MB page) → `unable_to_check` with reason, no crash. Test in Task 6.
3. **Sitemap is an index (`<sitemapindex>`) or listed only in robots.txt** → treated as valid. Test in Task 6.
4. **`localStorage` quota exceeded** (big logo + 10 scans) → oldest scan dropped and retried; if still full, a clear user message. Test in Task 11.
5. **Internationalised domain names** (`café.fr`) → accepted and converted to punycode, not rejected. Test in Task 3.

---

## File Structure

```
app/layout.tsx, app/globals.css
app/login/page.tsx
app/(app)/layout.tsx                 header with logout
app/(app)/page.tsx                   URL entry + recent scans
app/(app)/scan/[id]/page.tsx         dashboard (client)
app/api/login/route.ts, app/api/logout/route.ts
app/api/scan/route.ts, app/api/pagespeed/route.ts
proxy.ts                             (or middleware.ts if the installed Next.js predates the rename)
lib/types.ts                         all shared types
lib/security/url.ts                  normaliseAndValidateUrl
lib/security/ip.ts                   isPrivateAddress
lib/security/safe-fetch.ts           safeFetch
lib/security/session.ts              signSession / verifySession
lib/ratelimit.ts
lib/gather/direct.ts, robots.ts, sitemap.ts, firecrawl.ts, index.ts (gather)
lib/html.ts                          loadHtml, visibleText, wordCount helpers (Cheerio)
lib/checks/registry.ts, run.ts
lib/checks/technical/*.ts, content/*.ts, conversion/*.ts, ai/*.ts, performance.ts
lib/content/checks.ts                pre-written copy per checkId
lib/pagespeed.ts                     fetch + normalise
lib/report/draft.ts, summary.ts, region.ts
lib/storage.ts
components/ui/*                      shadcn
components/dashboard/*               FindingCard, SummaryStrip, PerformancePanel, ReportPanel, etc.
components/report/ReportDocument.tsx, ReportPreview.tsx
tests/fixtures/*                     html, robots, sitemap, pagespeed json
tests/**/*.test.ts(x)
```

---

### Task 1: Project scaffold

**Files:**
- Create: Next.js app at repo root, `vitest.config.ts`, `tests/setup.ts`, `.env.example`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run test`, `npm run lint`; path alias `@/*` → repo root.

- [ ] **Step 1:** `git init`; scaffold with `npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*"`. If it refuses because `docs/`/`.claude/` exist, scaffold into `./_app` and move its contents to the root, then delete `_app`.
- [ ] **Step 2:** `npx shadcn@latest init` (defaults, neutral base colour); add components: `button input label card badge switch textarea separator alert tabs skeleton sonner`.
- [ ] **Step 3:** Install deps: `cheerio @mendable/firecrawl-js @upstash/ratelimit @upstash/redis @react-pdf/renderer punycode`; dev: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`. Add `"test": "vitest run"` script; vitest env `jsdom` for `*.test.tsx`, `node` otherwise; alias `@`.
- [ ] **Step 4:** Write `tests/smoke.test.ts`: `it('runs', () => expect(1 + 1).toBe(2))`. Run `npm run test` → PASS.
- [ ] **Step 5:** `.env.example` lists every env var from Global Constraints with a comment each; `.gitignore` includes `.env*` except `.env.example`. README: setup steps from spec §14.
- [ ] **Step 6:** `npm run build` → succeeds. Commit `chore: scaffold Next.js app with Tailwind, shadcn/ui, Vitest`.

---

### Task 2: Core types and check engine

**Files:**
- Create: `lib/types.ts`, `lib/checks/registry.ts`, `lib/checks/run.ts`, `lib/content/checks.ts`
- Test: `tests/checks/run.test.ts`

**Interfaces:**
- Produces (in `lib/types.ts`):

```ts
export type Severity = 'critical' | 'warning' | 'opportunity' | 'info' | 'passed';
export type Category = 'technical-seo' | 'content' | 'conversion' | 'ai-readiness' | 'performance';
export type CheckStatus = 'pass' | 'fail' | 'observation' | 'not_applicable' | 'unable_to_check';
export type Confidence = 'verified' | 'heuristic';
export type LimitationCode = 'firecrawl_unavailable' | 'homepage_blocked' | 'homepage_unreachable' | 'non_html' | 'too_large' | 'js_fallback' | 'robots_unavailable' | 'sitemap_unavailable' | 'performance_unavailable' | 'field_data_unavailable';
export type EvidenceSource = 'rendered' | 'raw' | 'headers' | 'robots' | 'sitemap' | 'pagespeed';

export interface Finding {
  checkId: string; category: Category; status: CheckStatus; severity: Severity;
  confidence: Confidence; evidence: Record<string, unknown>; source: EvidenceSource; unableReason?: string;
}
export type CheckOutcome = Omit<Finding, 'checkId' | 'category' | 'confidence'>;
// severity for status 'observation' is 'info'; for 'pass' is 'passed'; for unable/not_applicable is 'info'

export interface RobotsGroup { userAgents: string[]; allow: string[]; disallow: string[] }
export interface PageData {
  inputUrl: string; finalUrl: string; scannedAt: string;
  homepage: {
    status: number | null; blocked: boolean; blockReason?: string; unreachableReason?: string;
    contentType: string | null; headers: Record<string, string>;
    redirectChain: string[]; rawHtml: string | null;
  };
  httpRedirectsToHttps: boolean | null;          // null = could not determine
  rendered: { html: string } | null;              // Firecrawl output; null = fallback
  robots: { state: 'found' | 'missing' | 'error'; groups: RobotsGroup[]; sitemaps: string[] };
  sitemap: { state: 'valid' | 'invalid' | 'missing' | 'error'; url: string | null; isIndex: boolean };
  favicon: { linkTag: boolean; icoStatus: number | null };
  llmsTxt: { present: boolean | null };
  jsRendered: boolean;
  loadedWith: 'firecrawl' | 'direct-fallback';
  limitations: LimitationCode[];
}
export interface Check { id: string; category: Category; confidence: Confidence; run(page: PageData): CheckOutcome }
export interface ScanResult {
  id: string; url: string; finalUrl: string; scannedAt: string;
  findings: Finding[]; jsRendered: boolean; loadedWith: PageData['loadedWith']; limitations: LimitationCode[];
}
export interface ScanResponse { scan: ScanResult; performanceTicket: string }
export const LIMITATION_TEXT: Record<LimitationCode, string>   // fixed plain-language sentences, in lib/content/limitations.ts
export interface CheckCopy { title: string; clientTitle: string; whyItMatters: string; howToFix: string }
```

- Produces: `checks: Check[]` (registry, initially empty), `runChecks(page: PageData): Finding[]`, `CHECK_COPY: Record<string, CheckCopy>`.

- [ ] **Step 1: Write failing tests** in `tests/checks/run.test.ts` using a fake registry injected via `runChecks(page, registry?)`:

```ts
it('maps each check to a finding with checkId and category', ...)          // expect(f.checkId).toBe('fake')
it('isolates a throwing check as unable_to_check', ...)                  // status 'unable_to_check', unableReason 'Internal check error', severity of check default 'info'
it('preserves registry order', ...)
it('copies check.confidence onto the finding', ...)
it('returned findings are frozen (mutating evidence throws in strict mode)', ...)
```

- [ ] **Step 2:** Run `npm run test -- tests/checks/run.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `runChecks(page: PageData, registry: Check[] = checks): Finding[]` — try/catch per check; on throw return `{status:'unable_to_check', severity:'info', evidence:{}, source:'raw', unableReason:'Internal check error'}`. Deep-freeze returned findings (`Object.freeze` recursively) so evidence is immutable.
- [ ] **Step 4:** Add `tests/checks/copy.test.ts`: `it('every registered check has copy', () => checks.forEach(c => expect(CHECK_COPY[c.id]).toBeDefined()))` plus `performance` ids `lab-performance`, `field-cwv`. Run → PASS (registry empty for now; test grows as checks are added).
- [ ] **Step 5:** Commit `feat: core types and isolated check runner`.

---

### Task 3: URL validation and SSRF-guarded fetch

**Files:**
- Create: `lib/security/url.ts`, `lib/security/ip.ts`, `lib/security/safe-fetch.ts`
- Test: `tests/security/url.test.ts`, `tests/security/ip.test.ts`, `tests/security/safe-fetch.test.ts`

**Interfaces:**
- Produces:
  - `normaliseAndValidateUrl(input: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>` — returns origin homepage `https://host/` (or `http://` if the user typed http).
  - `isPrivateAddress(ip: string): boolean`
  - `safeFetch(url: string, opts: { timeoutMs: number; maxBytes: number; maxRedirects?: number; method?: 'GET' | 'HEAD' }): Promise<SafeFetchResult>` where
    `SafeFetchResult = { ok: true; status: number; finalUrl: string; redirectChain: string[]; headers: Record<string,string>; body: string; truncated: boolean } | { ok: false; reason: 'timeout' | 'blocked_address' | 'too_many_redirects' | 'too_large' | 'network' | 'dns'; message: string }`

- [ ] **Step 1: Write failing tests:**

```ts
// url.test.ts (mock dns.promises.lookup)
it('adds https and strips path/query/whitespace', ...)    // ' Example.com/about?x=1 ' → 'https://example.com/'
it('converts IDN to punycode', ...)                        // 'café.fr' → 'https://xn--caf-dma.fr/'
it('rejects non-http schemes', ...)                        // 'ftp://x.com', 'javascript:alert(1)', 'file:///etc/passwd' → ok:false
it('rejects credentials in URL', ...)                      // 'https://user:pass@x.com'
it('rejects non-standard ports', ...)                      // 'https://x.com:8080'
it('rejects localhost and IP-literal private hosts', ...)  // 'localhost', '127.0.0.1', '[::1]', '10.0.0.5', '169.254.169.254'
it('rejects hostnames resolving to private IPs', ...)      // lookup → 192.168.1.10
// ip.test.ts
it.each(['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','0.0.0.0','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])('%s is private', ...)
it.each(['8.8.8.8','1.1.1.1','2606:4700::1111'])('%s is public', ...)
// safe-fetch.test.ts (mock global fetch + dns)
it('follows redirects manually and records the chain', ...)
it('blocks a redirect to a private address', ...)          // reason 'blocked_address'
it('stops after 5 redirects', ...)                          // reason 'too_many_redirects'
it('aborts bodies over maxBytes', ...)                      // reason 'too_large'
it('times out', ...)                                        // reason 'timeout'
it('sends the SiteLensBot user agent', ...)
```

- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3:** Implement connection-time validation (spec §17.1). Install `undici`. Create `lib/security/agent.ts` exporting `createSafeAgent(lookupFn = dns.lookup)`: an `undici.Agent` with `connect: { lookup }` where `lookup` resolves with `{ all: true }`, rejects with a `BlockedAddressError` if **any** address is private, and returns only validated addresses (so the socket connects to exactly what was checked). `safeFetch` uses `undici.request`/`fetch` with this dispatcher, `maxRedirections: 0`, and follows redirects manually (each hop re-validated: scheme, port, IP-literal check via `isPrivateAddress`, then the agent's lookup). IP-literal hosts are checked before connecting because they bypass lookup. Normalise numeric IP encodings (`2130706433`, `0x7f.1`, `0177.0.0.1`) via the WHATWG URL parser before checking. Body read as a stream with a byte counter.
- Add to Step 1 tests (`tests/security/safe-fetch.test.ts`):
```ts
it('DNS rebinding: validation passes then lookup at connect returns 127.0.0.1 → blocked_address', ...)  // lookupFn returns public first call, private second
it('blocks when any of multiple resolved addresses is private', ...)
it('blocks IP-literal hosts incl. [::ffff:127.0.0.1], 2130706433, 0x7f.0.0.1', ...)
it('blocks redirect to http://169.254.169.254/', ...)
it('connects to the validated address (agent lookup result is used)', ...)
```
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat: URL validation and SSRF-guarded fetch`.

---

### Task 4: Shared-code access (session, login, proxy)

**Files:**
- Create: `lib/security/session.ts`, `app/api/login/route.ts`, `app/api/logout/route.ts`, `proxy.ts`, `app/login/page.tsx`
- Test: `tests/security/session.test.ts`, `tests/api/login.test.ts`, `tests/proxy.test.ts`

**Interfaces:**
- Produces: `signSession(nowMs?: number): Promise<string>`, `verifySession(token: string | undefined, nowMs?: number): Promise<boolean>`, `requireSession(req: Request): Promise<Response | null>` (returns 401 Response when invalid, else null — every route handler calls it first), `SESSION_COOKIE = 'sitelens_session'`.
- Use Web Crypto (`crypto.subtle`, HMAC-SHA256) so the same code runs in the proxy and Node routes. Token format: `<expiryMs>.<base64url signature>`.

- [ ] **Step 1: Write failing tests:**

```ts
it('verifies a fresh token', ...)
it('rejects a tampered token', ...)
it('rejects an expired token (30 days + 1 ms)', ...)
it('rejects when SESSION_SECRET changes', ...)
// login route
it('sets the cookie on the correct code', ...)       // 200, Set-Cookie contains sitelens_session, HttpOnly, SameSite=Lax
it('returns 401 on a wrong code', ...)
it('returns 429 with a friendly message when rate-limited', ...)  // mock limiter from Task 5 interface
// proxy
it('redirects unauthenticated page requests to /login', ...)
it('returns 401 JSON for unauthenticated /api/scan', ...)
it('allows /login and /api/login without a session', ...)
it('allows authenticated requests through', ...)
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement session helpers; login route compares codes with a constant-time comparison (compare HMACs of both values); logout clears the cookie. `proxy.ts` matcher excludes `_next/static`, `_next/image`, `favicon.ico`. Login page: single code field, error text "That code didn't work." — build UI with the `frontend-design` skill guidance, shadcn `Card`, `Input`, `Button`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: shared access code with signed session cookie and proxy`.

---

### Task 5: Rate limiting

**Files:**
- Create: `lib/ratelimit.ts`
- Test: `tests/ratelimit.test.ts`

**Interfaces:**
- Also create: `lib/tickets.ts` + `tests/tickets.test.ts`.
- Produces: `checkScanLimit(ip: string): Promise<LimitResult>`, `checkPageSpeedLimit(ip: string): Promise<LimitResult>` (10/h/IP keyed `psi:ip:<ip>`, 100/day keyed `psi:global`), `checkLoginLimit(ip: string): Promise<LimitResult>`, `issuePerformanceTicket(scanId: string, url: string, nowMs?): Promise<string>`, `redeemPerformanceTicket(ticket: string, url: string, nowMs?): Promise<{ ok: true } | { ok: false; error: string }>` (verifies HMAC with `SESSION_SECRET`, expiry 10 min, URL match, then `SET psi:ticket:<scanId> 1 NX EX 900`; already used → "This performance check has already been run."), `getClientIp(req: Request): string` (first `x-forwarded-for` entry, else `'unknown'`), where `LimitResult = { ok: true } | { ok: false; message: string }`.
- Messages: scans/hour → "You've reached the hourly scan limit. Please try again later."; global/day → "Daily scan limit reached, try again tomorrow."; login → "Too many attempts. Please wait 15 minutes."

- [ ] **Step 1: Write failing tests** (mock `@upstash/ratelimit`):

```ts
it('allows under the limit', ...)
it('returns the hourly message when the per-IP limiter denies', ...)
it('returns the daily message when the global limiter denies', ...)
it('is a no-op when Upstash env is missing and NODE_ENV !== production', ...)
it('fails closed (ok:false, "Rate limiting is not configured.") when env is missing in production', ...)
it('pagespeed limiter is independent of the scan limiter', ...)
// tickets.test.ts
it('redeems a fresh ticket once; second redeem fails', ...)
it('rejects a ticket for a different URL', ...)
it('rejects an expired (10 min + 1 ms) or tampered ticket', ...)
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `Ratelimit.slidingWindow(10, '1 h')` keyed `scan:ip:<ip>`, `Ratelimit.fixedWindow(100, '1 d')` keyed `scan:global`, `Ratelimit.slidingWindow(10, '15 m')` keyed `login:ip:<ip>`. Wire `checkLoginLimit` into the login route (Task 4 test now uses the real interface).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: Upstash rate limits for scans and login`.

---

### Task 6: Direct gathering (raw HTML, headers, robots, sitemap, favicon, llms.txt)

**Files:**
- Create: `lib/gather/direct.ts`, `lib/gather/robots.ts`, `lib/gather/sitemap.ts`, `lib/html.ts`
- Test: `tests/gather/direct.test.ts`, `tests/gather/robots.test.ts`, `tests/gather/sitemap.test.ts`, `tests/html.test.ts`, fixtures in `tests/fixtures/`

**Interfaces:**
- Consumes: `safeFetch` (Task 3).
- Produces:
  - `fetchHomepage(url: string): Promise<PageData['homepage'] & { finalUrl: string }>`
  - `checkHttpRedirect(finalUrl: string): Promise<boolean | null>`
  - `parseRobots(body: string): { groups: RobotsGroup[]; sitemaps: string[] }`, `fetchRobots(origin): Promise<PageData['robots']>`
  - `isPathAllowed(groups: RobotsGroup[], userAgent: string, path: string): boolean` (longest-match wins; `*` group as fallback)
  - `fetchSitemap(origin: string, robotsSitemaps: string[]): Promise<PageData['sitemap']>`
  - `fetchFavicon(origin, html): Promise<PageData['favicon']>`, `fetchLlmsTxt(origin): Promise<PageData['llmsTxt']>`
  - `loadHtml(html: string): CheerioAPI`, `visibleText($): string` (excludes script/style/noscript/template), `wordCount(text: string): number`, `looksLikeJsShell(rawHtml: string): boolean` (visible words < 50 AND (body has a single empty root div like `#root`/`#__next`/`#app`, or script tags > 0))

- [ ] **Step 1: Write failing tests:**

```ts
it('marks 403 / 429 / 401 as blocked with reason "This site blocked our automated check"', ...)
it('detects a Cloudflare-style challenge page as blocked', ...)   // fixture with "cf-chl" / "Just a moment..." title, status 503
it('marks DNS failure as unreachable', ...)
it('retries a 5xx once, then reports unreachable', ...)
it('returns contentType and leaves rawHtml null for non-HTML responses', ...)        // Review Focus 2
it('flags truncated >5 MB pages as unable (reason "Page too large to analyse")', ...) // Review Focus 2
it('parses robots groups, allow/disallow, and Sitemap lines', ...)
it('isPathAllowed: Disallow: / for * blocks everything', ...)
it('isPathAllowed: specific GPTBot group overrides *', ...)
it('accepts a <sitemapindex> as valid with isIndex true', ...)                        // Review Focus 3
it('uses the robots.txt Sitemap: URL when /sitemap.xml is 404', ...)                  // Review Focus 3
it('marks unparseable sitemap as invalid', ...)
it('visibleText ignores scripts and styles', ...)
it('looksLikeJsShell true for <div id="root"></div><script src=app.js>', ...)
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement using Cheerio (`xmlMode: true` for sitemaps). Timeouts/caps from Global Constraints.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: direct page gathering with robots, sitemap, favicon, llms.txt`.

---

### Task 7: Firecrawl gathering and `gather()` orchestration

**Files:**
- Create: `lib/gather/firecrawl.ts`, `lib/gather/index.ts`
- Test: `tests/gather/gather.test.ts`

**Interfaces:**
- Consumes: Task 6 functions.
- Produces: `scrapeRendered(url: string): Promise<{ html: string } | null>` (null on missing key, error, or 30 s timeout; request rendered HTML format only, `onlyMainContent: false`), `gather(url: string): Promise<PageData>`.

- [ ] **Step 1: Write failing tests** (mock Firecrawl SDK and Task 6 functions):

```ts
it('uses Firecrawl HTML and sets loadedWith "firecrawl"', ...)
it('falls back to direct when FIRECRAWL_API_KEY is missing', ...)   // rendered null, loadedWith 'direct-fallback'
it('falls back when Firecrawl throws or times out', ...)
it('sets jsRendered from looksLikeJsShell(rawHtml)', ...)
it('runs direct fetch, robots, sitemap, favicon, llms.txt in parallel (Promise.all)', ...)
it('still returns PageData when the homepage is blocked', ...)       // homepage.blocked true, rendered may be non-null
it('limitations: firecrawl failure → ["firecrawl_unavailable", ...]; blocked → "homepage_blocked"; fallback + shell → "js_fallback"; robots error → "robots_unavailable"', ...)
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; verify the current Firecrawl SDK method and `formats` option name against docs before coding.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: Firecrawl rendering with direct-fetch fallback`.

---

### Tasks 8–11a: Check modules

Shared rules for every check task:
- One file per check exporting `const check: Check`; register in `lib/checks/registry.ts`; add `CHECK_COPY[id]` with all four fields (plain language, business-impact `whyItMatters`, concrete `howToFix`).
- Rendered-HTML checks read `page.rendered?.html ?? page.homepage.rawHtml` and set `source` accordingly (`'rendered'` / `'raw'`).
- If the HTML they need is null (blocked/unreachable/non-HTML) → `unable_to_check` with `page.homepage.blockReason ?? unreachableReason ?? 'Homepage could not be read'`.
- Text-dependent checks (word-count, contact-method, cta, click-to-call, machine-readable-contact) return `unable_to_check` with reason "This site loads its content with JavaScript" when `page.loadedWith === 'direct-fallback' && page.jsRendered`.
- `pass` → severity `'passed'`. Severities, thresholds, and fail conditions are those in spec §7.3 **as amended by §17.3–17.4**: Critical only for site-reachable, https, indexable, robots-allows; `viewport` Warning; `contact-method` Warning (heuristic); `cta` Opportunity (heuristic); `robots-present`, `ai-crawlers`, `llms-txt` return status `observation` (severity `info`), never `fail`.
- Each check declares `confidence`: heuristic = word-count, contact-method, click-to-call, cta, analytics, machine-readable-contact, no-js-content, heading-order, copyright-year; all others verified. Test: `it('no heuristic check ever returns critical', ...)` iterating the registry over a set of fixture pages (in `tests/checks/severity.test.ts`).
- Missing input → `unable_to_check` with the matching limitation text, never `fail` (§17.8).
- Each check gets a test file `tests/checks/<category>/<id>.test.ts` with at least: pass, fail (asserting exact `severity` and key `evidence` fields), and unable case. Use a `makePage(overrides)` helper in `tests/helpers/page.ts` (create in Task 8).
- Step pattern per task: write tests → run (FAIL) → implement → run (PASS) → commit.

### Task 8: Technical & SEO checks

**Files:** `lib/checks/technical/{site-reachable,https,http-redirect,redirect-chain,indexable,robots-present,robots-allows,sitemap,title,meta-description,single-h1,canonical,html-lang,viewport,img-alt,open-graph,favicon}.ts`, `tests/helpers/page.ts`, tests per check.

Key assertions (beyond the shared rules):
```ts
// site-reachable
it('blocked homepage → unable_to_check, never fail', ...)
it('404 → fail critical with evidence.status 404', ...)
// indexable
it('meta robots noindex → fail critical, evidence.directive "noindex", evidence.where "meta"', ...)
it('X-Robots-Tag noindex header → fail critical, evidence.where "header"', ...)
// title
it('missing → warning', ...); it('25 chars → opportunity, evidence {text, length: 25}', ...); it('45 chars → passed', ...)
// meta-description: missing → warning; length outside 70–160 → opportunity
// redirect-chain: 3 hops → opportunity with evidence.chain
// img-alt: evidence { missingCount, examples: first 10 filenames }; alt="" counts as present
// canonical: different host → opportunity, evidence.canonical
// robots-allows: Disallow: / under * → critical; robots missing → not_applicable
// http-redirect: null → unable_to_check
```
- [ ] Steps per shared pattern. Commit `feat: technical and SEO checks`.

### Task 9: Content checks

**Files:** `lib/checks/content/{word-count,copyright-year,heading-order}.ts` + tests.
```ts
it('word-count 249 → warning, 250 → passed; evidence.words', ...)
it('copyright-year: © 2019 scanned 2026-11-15 → opportunity, evidence.year 2019', ...)
it('copyright-year: © 2025 → passed; no year found → not_applicable', ...)
it('copyright-year: range "© 2015–2026" uses the latest year → passed', ...)
it('heading-order: H1 then H3 → opportunity, evidence.skip "h1→h3"', ...)
```
- [ ] Steps per shared pattern. Commit `feat: content checks`.

### Task 10: Conversion checks

**Files:** `lib/checks/conversion/{contact-method,click-to-call,cta,analytics}.ts` + tests.
- CTA phrase list (case-insensitive, matched against `a`/`button` text and `input[type=submit]` value): `contact, call, book, quote, get started, buy, enquire, inquire, schedule, request, sign up, order, shop, get in touch, free consultation`.
- Analytics patterns (script src or inline): `googletagmanager.com/gtag/js`, `googletagmanager.com/gtm.js`, `google-analytics.com`, `connect.facebook.net`/`fbq(`, `plausible.io`, `usefathom.com`, `matomo`.
```ts
it('contact-method: none of tel:/mailto:/form → critical', ...)
it('contact-method: evidence lists which were found', ...)
it('cta: evidence.matches lists up to 5 matched texts', ...)
it('analytics: GTM detected → passed, evidence.tools ["Google Tag Manager"]', ...)
it('analytics: none → opportunity', ...)
```
- [ ] Steps per shared pattern. Commit `feat: conversion checks`.

### Task 11a: AI search readiness checks

**Files:** `lib/checks/ai/{ai-crawlers,no-js-content,structured-data,machine-readable-contact,llms-txt}.ts` + tests.
- Crawlers: `GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot`; use `isPathAllowed(groups, ua, '/')`.
- `ai-crawlers` and `llms-txt` produce status `observation` with severity `info` (never `fail`; §17.4) — evidence `{ crawlers: { GPTBot: 'allowed' | 'blocked', ... } }` / `{ present: boolean }`. robots missing → all `allowed`, evidence notes "no robots.txt". `llmsTxt.present === null` → unable_to_check.
- `no-js-content`: needs both raw and rendered HTML; fail (warning) when raw visible words < 30% of rendered visible words AND raw < 150 words; evidence `{ rawWords, renderedWords }`. Fallback mode → use `jsRendered` (fail if true) with evidence `{ rawWords }`.
- `structured-data`: parse all `script[type="application/ld+json"]` (tolerate invalid JSON → counted as `invalidBlocks`); handle `@graph` and arrays; fail if none or none of type `Organization`/`LocalBusiness` (or LocalBusiness subtypes — accept any `@type` ending in `Business`, plus `Restaurant`, `Store`, `ProfessionalService`); evidence `{ types: string[], invalidBlocks }`.
- `machine-readable-contact`: phone from `a[href^="tel:"]` or JSON-LD `telephone`; address from JSON-LD `address`/`PostalAddress` or `<address>`; evidence `{ phoneFound, addressFound }`; fail (opportunity) if either missing.
```ts
it('ai-crawlers: GPTBot blocked, others allowed', ...)
it('structured-data: @graph containing LocalBusiness → passed', ...)
it('structured-data: invalid JSON block is counted, not thrown', ...)
it('machine-readable-contact: tel link but no address → opportunity, evidence {phoneFound:true,addressFound:false}', ...)
it('no-js-content: raw 40 words, rendered 600 → warning', ...)
```
- [ ] Steps per shared pattern. Commit `feat: AI search readiness checks`.

---

### Task 11b: Scan API route

**Files:**
- Create: `app/api/scan/route.ts`
- Test: `tests/api/scan.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `checkScanLimit`, `getClientIp`, `normaliseAndValidateUrl`, `gather`, `runChecks`.
- Produces: `POST /api/scan` body `{ url: string }` → `200 ScanResponse` (`{ scan, performanceTicket }`) | `400 { error }` | `401` | `429 { error }` | `500 { error: 'Scan failed. Please try again.' }`. `id = crypto.randomUUID()`. No logging of URLs or results beyond errors.

- [ ] **Step 1: Tests:** 401 without session; 400 with `{error}` for invalid URL; 429 with limiter message; 200 returns findings for every registered check (`findings.length === checks.length`); `scannedAt` is ISO.
- [ ] **Step 2–4:** FAIL → implement (`runtime='nodejs'`, `maxDuration=60`) → PASS.
- [ ] **Step 5:** Commit `feat: scan API route`.

---

### Task 12: PageSpeed Insights

**Files:**
- Create: `lib/performance/index.ts`, `lib/performance/types.ts`, `lib/performance/providers/pagespeed.ts`, `lib/checks/performance.ts`, `app/api/pagespeed/route.ts`
- Test: `tests/pagespeed.test.ts`, `tests/checks/performance.test.ts`, `tests/api/pagespeed.test.ts`, fixtures `tests/fixtures/psi-full.json`, `psi-no-field.json`, `psi-error.json` (save real responses; strip large `audits` detail not used)

**Interfaces:**
- Produces:

```ts
export type CwvRating = 'good' | 'needs-improvement' | 'poor';
export interface FieldMetric { p75: number; rating: CwvRating }
export interface PageSpeedResult {
  fetchedAt: string; strategy: 'mobile';
  lab: { scores: { performance: number; accessibility: number; bestPractices: number; seo: number };   // 0–100 integers
         metrics: { lcpMs: number; cls: number; tbtMs: number; fcpMs: number; speedIndexMs: number } };
  field: { scope: 'url' | 'origin'; lcp?: FieldMetric; inp?: FieldMetric; cls?: FieldMetric } | null;  // null = not enough real-user data
}
export type PageSpeedOutcome = { ok: true; data: PageSpeedResult } | { ok: false; unavailable: string };
// Provider isolation (spec §17.6): app code imports only from lib/performance/index.ts
export interface PerformanceProvider { id: string; fetch(url: string): Promise<PageSpeedOutcome> }
export const pageSpeedProvider: PerformanceProvider      // lib/performance/providers/pagespeed.ts
export function getPerformanceProvider(): PerformanceProvider
normalisePageSpeed(json: unknown): PageSpeedResult | null   // null when required lab fields are missing → outcome unavailable
performanceFindings(o: PageSpeedOutcome): Finding[]   // ids 'lab-performance', 'field-cwv'
```
- Field: prefer `loadingExperience` (scope `url`) when it has metrics, else `originLoadingExperience` (scope `origin`); map `FAST/AVERAGE/SLOW` → `good/needs-improvement/poor`. Use API categories `performance, accessibility, best-practices, seo`, `strategy=mobile`.

- [ ] **Step 1: Tests:**
```ts
it('normalises scores ×100 rounded and lab metrics from audits', ...)    // compare to fixture values
it('returns field null when neither loadingExperience has metrics', ...)
it('uses origin scope when only originLoadingExperience exists', ...)
it('returns {ok:false, unavailable} on API error or 60 s timeout', ...)
it('lab-performance: score 49 → warning, 50 → passed; evidence.score', ...)
it('field-cwv: any poor → warning listing poor metrics; field null → unable_to_check "Google does not have enough real-user data for this site."', ...)
it('unavailable outcome → both findings unable_to_check with the reason', ...)
it('normalise tolerates missing/renamed fields: unknown shape → null, never throws', ...)
it('route: 401 without session; 400 invalid URL; 403 missing/used/mismatched ticket; 429 on pagespeed limit', ...)  // body { url, ticket }
```
- [ ] **Step 2–4:** FAIL → implement (route `maxDuration=90`, key from `PAGESPEED_API_KEY`, URL validated with `normaliseAndValidateUrl`) → PASS. Add `CHECK_COPY` for both ids.
- [ ] **Step 5:** Commit `feat: PageSpeed Insights lab and field data`.

---

### Task 13: Report logic and browser storage

**Files:**
- Create: `lib/report/draft.ts`, `lib/report/summary.ts`, `lib/report/region.ts`, `lib/storage.ts`
- Test: `tests/report/draft.test.ts`, `tests/report/summary.test.ts`, `tests/storage.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ReportDraft { scanId: string; includedCheckIds: string[]; includePerformance: boolean; clientBusinessName?: string; nextSteps?: string }
export interface Branding { name?: string; logoDataUrl?: string; contact?: string; region: 'UK' | 'US' }
export interface ScanRecord { scan: ScanResult; performanceTicket?: string; pagespeed?: PageSpeedOutcome; draft: ReportDraft }  // ticket deleted once used
defaultDraft(scan: ScanResult): ReportDraft                       // §7.1a defaults
isToggleable(f: Finding): boolean                                  // false for unable_to_check, not_applicable
reportSections(scan: ScanResult, pagespeed: PageSpeedOutcome | undefined, draft: ReportDraft): {
  findings: Finding[]; passed: Finding[]; observations: Finding[]; couldNotCheck: Finding[]; performance: PageSpeedOutcome | null; selectionNote: boolean; limitations: LimitationCode[] }
buildSummary(scan, pagespeed, draft, region): string
formatDate(iso: string, region): string                           // UK '15 November 2026', US 'November 15, 2026'
pageSize(region): 'A4' | 'LETTER'
// storage.ts
listScans(): ScanRecord[]; getScan(id): ScanRecord | null; saveScan(r: ScanRecord): void
updateDraft(id, draft): void; setPageSpeed(id, o: PageSpeedOutcome): void   // only if not already set
getBranding(): Branding; saveBranding(b: Branding): void; deleteScan(id): void; clearAll(): void   // clearAll removes every sitelens:* key
class StorageFullError extends Error {}
```

- [ ] **Step 1: Tests:**
```ts
it('defaultDraft includes fail findings except info, includes passed, excludes info', ...)
it('reportSections always lists unable_to_check findings regardless of draft', ...)
it('reportSections hides performance when includePerformance false', ...)
it('performance findings (lab-performance, field-cwv) are toggleable like others', ...)
it('buildSummary: "We reviewed the homepage of example.com on 15 November 2026 and found 2 critical issues and 1 warning. The most important are: …" (top 3 by severity, clientTitle)', ...)
it('buildSummary adds "3 items couldn\'t be checked automatically." when N>0', ...)
it('buildSummary wording describes the report\'s selection: "This report highlights 2 issues selected for review…"', ...)
it('buildSummary never says "no issues" when failed findings are excluded', ...)  // §17.5
it('buildSummary with zero failed findings at all: "…we did not find significant issues in the areas we checked."', ...)
it('observations are never counted as issues', ...)
it('reportSections: excluded failed finding never appears in passed list', ...)
it('reportSections: selectionNote true when any failed finding is excluded', ...)
it('toggling the draft never mutates the ScanResult (deep-equal before/after)', ...)
it('buildSummary uses singular/plural correctly (1 warning / 2 warnings)', ...)
it('storage keeps only the 10 most recent scans', ...)
it('storage drops the oldest scan and retries on QuotaExceededError', ...)             // Review Focus 4
it('storage throws StorageFullError when still full with one scan', ...)                // Review Focus 4
it('storage survives localStorage throwing on access (returns empty)', ...)
it('clearAll removes all sitelens:* keys and nothing else', ...)
it('never stores keys containing access code or session values', ...)
it('setPageSpeed does not overwrite an existing outcome', ...)
```
- [ ] **Step 2–4:** FAIL → implement (keys `sitelens:scans`, `sitelens:branding`; all access in try/catch) → PASS.
- [ ] **Step 5:** Commit `feat: report draft logic, deterministic summary, browser storage`.

---

### Task 14: Home page and dashboard UI

Use the `frontend-design` and `design-taste-frontend` skills before writing components. Aim: calm, professional, information-dense but readable; shadcn components; responsive to tablet width.

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/page.tsx`, `app/(app)/scan/[id]/page.tsx`, `components/dashboard/{ScanForm,RecentScans,SummaryStrip,PerformancePanel,FindingCard,FindingGroups,StatusLists,JsBanner,ScopeLimitations}.tsx`
- Test: `tests/ui/FindingCard.test.tsx`, `tests/ui/ScanForm.test.tsx`, `tests/ui/PerformancePanel.test.tsx`

**Interfaces:**
- Consumes: Task 13 storage/draft functions, `CHECK_COPY`, `POST /api/scan`, `POST /api/pagespeed` (`{url}` → `PageSpeedOutcome`).
- Behaviour: `ScanForm` posts, saves `ScanRecord` with `defaultDraft`, routes to `/scan/[id]`; shows server `error` text inline; disables submit while scanning (prevents double-submit). Dashboard loads record from storage (not found → "This scan isn't saved in this browser." + link home); if `pagespeed` undefined, calls `/api/pagespeed` once and `setPageSpeed` (guard against setting state after unmount).
- `FindingCard` shows title, severity badge, evidence rendered as read-only key/value list (no inputs), source label, whyItMatters, howToFix, and a `Switch` labelled "Include in client report" (hidden for non-toggleable). Excluded cards dimmed with "Restore" button.
- `SummaryStrip`: counts Critical / Warning / Opportunity / Passed — no score.
- `PerformancePanel`: lab block titled "Google Lighthouse (lab, mobile)", field block titled "Real-user data (Google)" with scope note ("this page" / "whole site"), skeleton while loading, unavailable/no-data messages verbatim from spec.
- `ScopeLimitations`: spec §7.5 text; JS sentence depends on `loadedWith`; plus `LIMITATION_TEXT` for each code in `scan.limitations` and performance limitations.
- Header: **Clear all data** button (confirm dialog → `clearAll()` → home) and logout. Recent scans list has per-scan Delete. Footer note: "Scanned URLs are sent to Firecrawl and Google PageSpeed Insights for analysis. Results are stored only in this browser."
- Observations shown in their own list, not in severity counts.

- [ ] **Step 1: Tests:**
```ts
it('FindingCard renders evidence as text, with no editable inputs other than the include switch', ...)
it('FindingCard toggle calls onToggle(checkId, false) and shows Restore when excluded', ...)
it('FindingCard hides the switch for unable_to_check', ...)
it('ScanForm shows the API error message and re-enables submit', ...)
it('PerformancePanel shows "Google does not have enough real-user data for this site." when field null', ...)
it('PerformancePanel shows "Performance data unavailable" + reason when unavailable', ...)
```
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `npm run dev`, log in, scan a real site; verify findings, toggles, restore, performance fill-in in the browser. Commit `feat: home page and technical dashboard`.

---

### Task 15: Client PDF report with live preview and export

**Files:**
- Create: `components/report/ReportDocument.tsx`, `components/report/ReportPreview.tsx`, `components/dashboard/ReportPanel.tsx`
- Modify: `app/(app)/scan/[id]/page.tsx` (add ReportPanel)
- Test: `tests/report/document.test.tsx`

**Interfaces:**
- Consumes: `reportSections`, `buildSummary`, `formatDate`, `pageSize`, `CHECK_COPY`, `Branding`, `ReportDraft`.
- Produces: `ReportDocument(props: { scan; pagespeed; draft; branding }): JSX` (react-pdf `Document`), `ReportPreview` (client-only via `next/dynamic` with `ssr: false`, `PDFViewer`, debounced 400 ms re-render), export via `pdf(<ReportDocument/>).toBlob()` → download `website-review-<domain>-<yyyy-mm-dd>.pdf`.
- Sections and order exactly as spec §10 (cover, summary, findings, performance if included, what's working well, what we couldn't check, recommended next steps, scope & limitations); footer with page number and date on every page.
- `ReportPanel`: branding fields (name, logo upload PNG/JPG ≤ 500 KB with error "Logo must be a PNG or JPG under 500 KB.", contact, region UK/US), client business name, next steps textarea (max 1,500 chars with counter), Include-performance switch, preview, Export button. Branding saved via `saveBranding`; draft via `updateDraft`.

- [ ] **Step 1: Tests** (render `ReportDocument` to a tree / text with `@react-pdf/renderer`'s `renderToString` or by asserting on props passed to section components):
```ts
it('includes only included findings and every unable_to_check item', ...)
it('omits performance section when includePerformance false', ...)
it('omits the "What we couldn\'t check" section when there are none', ...)
it('adds the selection note to scope when a failed finding is excluded', ...)
it('lists limitation texts in the scope section', ...)
it('cover uses client business name, else domain; shows branding only when provided', ...)
it('evidence values appear exactly as in the scan (e.g. title length 25)', ...)
it('uses A4 for UK and LETTER for US', ...)
```
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** In the browser: toggle findings, edit next steps, upload a logo — preview updates; export and open the PDF; confirm it matches the preview. Commit `feat: white-label client PDF with live preview and export`.

---

### Task 16: Verification, review, and deployment readiness

**Files:**
- Modify: `README.md` (setup, env vars, how to change the access code, founder setup tasks §14)

- [ ] **Step 1:** `npm run lint && npm run test && npm run build` → all pass.
- [ ] **Step 2:** Manual acceptance (spec §12–13): scan 5–10 real small-business sites, including one Wix/Squarespace site, one JavaScript-heavy site, and one site that blocks bots. Run once with `FIRECRAWL_API_KEY` unset to exercise fallback. Record results in `docs/superpowers/acceptance/2026-11-15-v1.md`.
- [ ] **Step 3:** Use `superpowers:requesting-code-review` for a whole-branch review focused on: SSRF guard, session/proxy coverage of every route, no fabricated values, evidence immutability. Fix findings.
- [ ] **Step 4:** Use `superpowers:verification-before-completion`; check each acceptance criterion in spec §13.
- [ ] **Step 5:** Commit `docs: setup guide and acceptance results`.
- [ ] **Step 6 (requires founder approval — STOP and ask):** Deploy to Vercel (`vercel` CLI or Git integration) with env vars set in the Vercel dashboard. Do not deploy, create accounts, or add payment methods without explicit approval.
