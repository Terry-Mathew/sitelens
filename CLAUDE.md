# SiteLens: start every session here

Agents forget between sessions. Before you do any work, read these files:

1. `docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md`: the product requirements. Section 17 overrides earlier sections.
2. `docs/superpowers/plans/2026-11-15-sitelens-mvp.md`: the task plan.
3. The last entries in `.superpowers/sdd/2026-11-15-sitelens-mvp/progress.md`: the progress ledger. This file is local and git ignores it. If it is missing, use `git log`.

Trust the ledger and `git log` more than your memory.

## What SiteLens is

SiteLens is a website review tool for freelancers and small agencies. A freelancer enters the homepage URL of a possible client. SiteLens finds problems that it can prove. The freelancer then sends a white-label PDF report to the business owner. The report must be credible, because a business owner reads it.

Stack: Next.js (App Router) with TypeScript, Tailwind CSS, shadcn/ui, Firecrawl, Cheerio, Google PageSpeed Insights, Upstash Redis (rate-limit counters only), and `@react-pdf/renderer`. It deploys on Vercel. There is no database.

## Product rules

These rules are mandatory. A change that breaks one of them is a defect, even if the tests pass.

1. Do not invent a number, an issue, a score, or a business impact. Each value must come from the scan, from Google, or from the reviewed text in `lib/content/`.
2. Each finding must contain its evidence: the actual value that SiteLens observed.
3. When data is missing, show "not available" or `unable_to_check`. Do not show missing data as a pass or a fail.
4. Use Critical only for strong, verified evidence of a serious problem. A heuristic check must never be Critical.
5. A neutral fact, for example AI crawler access or `llms.txt`, is an `observation`. An observation is not a failure.
6. A `ScanResult` is frozen. The freelancer can include or exclude a finding in the report. The freelancer must never edit evidence or a measured value.
7. An excluded finding must not make the report claim that the site is healthy.
8. Do not show an overall site score. Label Google values as Google values. Keep lab data and field data separate.
9. Every report must show the scan scope and its limitations.

## Security and privacy rules

1. Send every user URL through `lib/security/`. Do this before you call Firecrawl, PageSpeed, or any other fetch.
2. The own fetcher must check each IP address at connection time and on each redirect. DNS rebinding is not an accepted risk.
3. Each route handler must check the session itself. The proxy is not the only check.
4. The scan endpoint and the PageSpeed endpoint must each have rate limits.
5. Browser storage keeps only scans, report drafts, and branding. Do not store the access code, the session token, or a credential.
6. Do not log scanned URLs or scan results on the server.

## Approval gates

You must get approval from the founder before you do these things:

- Deploy the app.
- Create an account on an external service.
- Add a paid service or a paid plan.
- Add a database, Python, FastAPI, Express, or another backend service.
- Add AI-generated text. AI is optional and must stay separate from the deterministic analysis.

## How to work

- Use test-driven development for the scanner (`lib/gather`, `lib/checks`, `lib/performance`). Use it for security code (`lib/security`, `lib/ratelimit`, `lib/tickets`, `proxy.ts`, and the API routes). Write the failing test first, then see it fail.
- To add a check, add one file in `lib/checks/<category>/`, one entry in `lib/checks/registry.ts`, and one entry in `lib/content/checks.ts`. Then add tests for the pass, fail, and unable cases.
- Do the checks without network calls. All network calls happen in `lib/gather/`.
- Before you build the interface, use the `frontend-design` and `design-taste-frontend` skills.
- Before you write Next.js code, read the guide in `node_modules/next/dist/docs/`. This Next.js version uses `proxy.ts`, not `middleware.ts`.
- Use the `superpowers` skills for plans, execution, debugging, and code review.
- Before you say that work is complete, run `npm run test`, `npm run lint`, and `npm run build`. Report the result honestly.

## Writing rules

All new text must use ASD-STE100 Simplified Technical English. This includes replies, commit messages, pull request descriptions, documentation, code comments, and user interface text. The full rules are in `AGENTS.md`. The most important rules:

1. Write short sentences. A procedure step must have 20 words or fewer.
2. Write one instruction in each sentence.
3. Use the active voice.
4. Use "must" for a requirement. Use "can" for a possibility.
5. Do not use contractions. Do not use a semicolon.
6. Use one word for one thing.
7. Apply these rules to new text only. Do not rewrite existing documents unless the founder asks.

Text in the client PDF must also be plain language for a business owner who is not technical.

---

# Behavioral guidelines

Source: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), `CLAUDE.md`, copied without changes. If a guideline conflicts with a project rule above, the project rule applies. When you run a task from the plan and something is not clear, ask the controller who gave you the task.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
