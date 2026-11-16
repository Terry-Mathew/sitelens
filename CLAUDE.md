# SiteLens: start every session here

Agents forget between sessions. Before you do any work, read these files:

1. `docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md`: the product requirements. Section 17 overrides earlier sections.
2. `docs/superpowers/plans/2026-11-15-sitelens-mvp.md`: the task plan.
3. The last entries in `.superpowers/sdd/2026-11-15-sitelens-mvp/progress.md`: the progress ledger. This file is local and git ignores it. If it is missing, use `git log`.
4. `docs/architecture/decisions/README.md`: the list of architecture decisions. A "Proposed" decision is not approved. Do not implement it until the founder approves it.

Next milestone (proposed, not approved): `docs/superpowers/specs/2026-11-16-sitelens-saas-foundation-design.md` and `docs/superpowers/plans/2026-11-16-sitelens-saas-foundation.md`. Read both before you work on accounts, the database, or Cloud Run.

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
3. SiteLens has no sign-in now (ADR-0007). Do not deploy it to the public internet before user sign-in exists. When sign-in exists, each route handler must check the user itself. The proxy must not be the only check.
4. The scan endpoint and the PageSpeed endpoint must each have rate limits.
5. Browser storage keeps only scans, report drafts, and branding. Do not store a session token or a credential.
6. Do not log scanned URLs or scan results on the server.

## Approval gates

You must get approval from the founder before you do these things:

- Deploy the app.
- Create an account on an external service.
- Add a paid service or a paid plan.
- Add a database, Python, FastAPI, Express, or another backend service.
- Add AI-generated text. AI is optional and must stay separate from the deterministic analysis.

## How to work

- Use test-driven development for the scanner (`lib/gather`, `lib/checks`, `lib/performance`). Use it for security code (`lib/security`, `lib/ratelimit`, `lib/tickets`, and the API routes). Write the failing test first, then see it fail.
- To add a check, add one file in `lib/checks/<category>/`, one entry in `lib/checks/registry.ts`, and one entry in `lib/content/checks.ts`. Then add tests for the pass, fail, and unable cases.
- Do the checks without network calls. All network calls happen in `lib/gather/`.
- Before you build the interface, use the `frontend-design` and `design-taste-frontend` skills.
- Before you write Next.js code, read the guide in `node_modules/next/dist/docs/`. This Next.js version uses `proxy.ts`, not `middleware.ts`.
- Use the `superpowers` skills for plans, execution, debugging, and code review.
- Before you say that work is complete, run `npm run check` and `npm run build`. Report the result honestly.

## Architecture and code quality rules

These rules apply to every change. Automated checks enforce some of them. The other rules depend on you. The founder is not a programmer. Do not expect the founder to read code line by line.

### Inspect before you create

- Read the relevant code before you write new code.
- Search for a component, function, utility, or pattern that already does the job. Search for names and for behavior.
- Reuse existing functionality. Do not make a second implementation of the same business logic. If a second implementation is necessary, write the reason in an ADR or in the review summary.
- Extend an existing module before you create a competing module.
- Do not add a dependency when an existing dependency or the platform can do the job. Do not add a second library for a job that an existing library does.
- Keep functions focused. Do not add a factory, a layer, or an abstraction for code that has one use.
- Do not refactor unrelated code while you implement a feature. Record the cleanup as a separate task.
- Do not make a breaking change without approval. Explain the impact first.
- Use the simplest solution that agrees with the existing architecture.

### Module boundaries

Keep each responsibility in its module. Do not move a responsibility without an ADR.

| Responsibility | Location | Rule |
|---|---|---|
| URL safety | `lib/security/` | Each fetch of a user URL goes through this module first. |
| Network calls for a scan | `lib/gather/` | This is the only module that fetches a scanned site. |
| Checks | `lib/checks/<category>/` | Pure functions. No network calls and no storage. |
| Performance data | `lib/performance/` | The provider stays behind the interface in `types.ts`. |
| Reviewed text | `lib/content/` | The only source of explanations and fixes. |
| Report logic | `lib/report/` | Pure functions. They never change a `ScanResult`. |
| Rate limits and tickets | `lib/ratelimit.ts`, `lib/tickets.ts` | Route handlers call these. Route handlers do not count requests themselves. |
| HTTP | `app/api/*/route.ts` | Thin handlers: user check (when sign-in exists), rate limit, validation, one call to `lib/`, HTTP response. No business rules. |
| Interface | `app/`, `components/` | No business rules. Use `lib/report/` for report decisions. |
| Database (proposed in ADR-0003) | `lib/db/` | The only place for SQL and Drizzle calls. |

### Mandatory check before a significant change

A significant change is a new feature, a change in more than one module, a new dependency, a change to data, authentication, or security, or a schema change.

Before you write code for a significant change, answer these questions:

1. What existing code is relevant?
2. What can you reuse?
3. Which files or modules must change?
4. Can the change cause duplication or conflicting logic?
5. Does the approach follow the existing architecture?

Then explain the approach to the founder in plain English. Get approval before you start. Use `docs/templates/IMPLEMENTATION_REVIEW.md` for this record.

For a routine, low-risk change, continue without approval. Examples: a bug fix in one module, a text change, or a new test.

### Architecture decision records (ADRs)

Write an ADR in `docs/architecture/decisions/` when a change adds or changes one of these:

- An architectural pattern.
- A significant dependency or framework.
- A database design or a data flow.
- An authentication or security decision.
- The responsibility of a module.
- A significant departure from the existing design.

Copy `ADR_TEMPLATE.md` and use the next number. Set the status to "Proposed" until the founder approves it. Do not write an ADR for a small bug fix or a routine interface change. Do not invent history. If the reason for existing code is not known, write "Unknown".

### Quality gates

Blocking checks must pass. The CI workflow in `.github/workflows/ci.yml` runs them on each pull request and each push to `main`:

- `npm run lint`: ESLint errors fail the check.
- `npm run typecheck`: TypeScript errors fail the check.
- `npm run test`: a failing test fails the check.
- `npm run build`: a failing production build fails the check.
- `npm run audit:prod`: a high or critical vulnerability in a production dependency fails the check.

Advisory checks report problems but do not fail:

- Complexity and function-length warnings in `npm run lint`.
- `npm run quality`: Knip (unused files, exports, and dependencies) and jscpd (duplicate code).

Do not add new warnings to code that you change. Do not disable a rule, skip a test, or relax a threshold to make a check pass. If you think a rule is wrong, ask the founder and record the reason. The current baseline is in `docs/architecture/quality-baseline.md`.

### Self-review before you say that work is complete

Read your own diff as a senior engineer. Look for these problems:

- Duplicate functionality.
- Unnecessary new files or abstractions.
- Conflict with the module boundaries above.
- Dead or unused code.
- Security vulnerabilities, for example a fetch that does not use `lib/security/`.
- Missing error handling.
- Performance problems.
- Breaking changes.
- Missing or weak tests.
- Unnecessary dependencies.

Correct each confirmed problem. Then run the blocking checks.

### Founder review summary

For a significant architecture change, a security-sensitive change, a database migration, or a breaking change, give the founder a plain-English summary. Then ask for approval. Answer these questions:

1. What changed?
2. Why was it necessary?
3. Did we reuse existing functionality?
4. Did we add a dependency?
5. What can break?
6. Which tests did we run, and what was the result?
7. Which risks are still open?

The approval of the founder is not proof of technical correctness. The automated checks and an independent code review (`superpowers:requesting-code-review`) are still necessary.

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
