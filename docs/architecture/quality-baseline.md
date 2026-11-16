# Code quality baseline and cleanup plan

- **Date:** 2026-11-16
- **Commit:** `ac029bd` (main), with the guardrail setup applied
- **Purpose:** record the state of the code before the quality gates start. New work must not make these numbers worse. The items below existed before the setup. The setup did not cause them.

## Tool results

| Check | Command | Type | Result |
|---|---|---|---|
| ESLint errors | `npm run lint` | Blocking | 0 errors |
| Complexity and function length | `npm run lint` | Advisory | 8 warnings (list below) |
| TypeScript | `npm run typecheck` | Blocking | 0 errors |
| Tests | `npm run test` | Blocking | 70 files, 834 tests, all pass |
| Production build | `npm run build` | Blocking | Passes, also with no `.env.local` (as in CI) |
| Production dependency audit | `npm run audit:prod` | Blocking at high and critical | 0 high, 0 critical. 4 moderate and 2 low, all inside the `shadcn` CLI package (`deepmerge`, `minimatch` through `ts-morph`). |
| Unused code and dependencies | `npm run quality:unused` (Knip) | Advisory | 4 unused files, 2 unused dependencies, 4 unused exports, 1 duplicate export |
| Duplicate code | `npm run quality:dupes` (jscpd) | Advisory | 2 clones, 18 lines (0.25 % of 7,087 lines) |

Vitest and TypeScript exclude `.claude/`. Agent sessions can create git worktrees in `.claude/worktrees/`. Without the exclusion, the tests of a worktree run as part of this project and the counts double.

### Complexity warnings (threshold: complexity 15, function length 120 lines)

| File | Function | Value |
|---|---|---|
| `components/report/ReportDocument.tsx:455` | `ReportDocument` | complexity 23 |
| `lib/checks/technical/indexable.ts:34` | `run` | complexity 22 |
| `components/dashboard/FindingCard.tsx:55` | `FindingCard` | complexity 19 |
| `lib/security/safe-fetch.ts:176` | `safeFetch` | complexity 18 |
| `lib/security/url.ts:37` | `normaliseAndValidateUrl` | complexity 17 |
| `lib/performance/providers/pagespeed.ts:78` | `normalisePageSpeed` | complexity 16 |
| `components/dashboard/ReportPanel.tsx:95` | `ReportPanel` | 212 lines |
| `components/dashboard/ScanDashboard.tsx:136` | `LoadedDashboard` | 130 lines |

The two security functions are complex because they check many cases in order. Their tests cover each case. Do not split them for style alone.

## Findings: technical debt

The scan found no large duplication and no parallel implementations of a business rule. The module boundaries in `CLAUDE.md` agree with the code. These are the confirmed items, most important first.

1. **The rate-limit result is turned into an HTTP response in more than one place.** `app/api/scan/route.ts` and `app/api/pagespeed/route.ts` each repeat the same `try / catch` and the same 503 and 429 mapping. If the rule changes, both must change. (A third copy was in `app/api/login/route.ts`. ADR-0007 removed that route on 2026-11-16.)
2. **Unused scaffold files and dependencies.** `components/ui/badge.tsx`, `separator.tsx`, `sonner.tsx`, `tabs.tsx` have no users. The dependencies `next-themes` and `sonner` are only used by `sonner.tsx`.
3. **One function has two names.** `lib/checks/helpers.ts` exports `withTextHtml` as a second name for `withHtml`. Six checks use the second name. Two names for one thing break the "one word for one thing" rule.
4. **The length rule for title and meta description is repeated.** `lib/checks/technical/title.ts` and `meta-description.ts` repeat the empty, in-range, and out-of-range logic. This is small, and each check is easy to read. Low priority.
5. **Four large interface functions.** `ReportDocument`, `ReportPanel`, `FindingCard`, and `LoadedDashboard` are long or complex. They work and have tests. Split them only when a feature changes them.

## Recommended cleanup tasks

Do each task alone, in a separate commit. Each task must keep the current behavior. Each task needs the founder's approval before it starts, because it is not part of a feature.

### Task A: one helper for the rate-limit response (finding 1)

- **Affected files:** the two route handlers, plus `lib/ratelimit.ts`.
- **Risk now:** a future change to the 503 or 429 rule can miss one route.
- **Preferred implementation:** keep `checkScanLimit` and `checkPageSpeedLimit`. Add one function, for example `limitResponse(result)`, in `lib/ratelimit.ts` that returns `Response | null`. Do this task together with the sign-in work, because sign-in can add a third limit.
- **Remove:** the copies of the 503 and 429 mapping.
- **Regression risk:** the order of checks in each route must stay the same (body, then limit). The PageSpeed route must still verify the ticket before the limit and redeem it after the limit.
- **Tests that must pass:** all route tests in `app/api/**`, `lib/ratelimit` tests, and a new unit test for `limitResponse` with the ok, limited, unconfigured, and thrown cases.

### Task B: remove unused scaffold code (finding 2)

- **Affected files:** the four `components/ui/` files, `package.json`, `package-lock.json`.
- **Risk now:** extra dependencies to update and audit, and agents can think that toasts or tabs are part of the design.
- **Preferred implementation:** none. Delete the files and run `npm uninstall next-themes sonner`.
- **Regression risk:** very low. Knip shows no import. `npm run build` proves it.
- **Tests that must pass:** `npm run check`, `npm run build`, and `npm run quality:unused` with no unused files.

### Task C: one name for the HTML helper (finding 3)

- **Affected files:** `lib/checks/helpers.ts` and the six checks that import `withTextHtml`.
- **Preferred implementation:** `withHtml`.
- **Remove:** the `withTextHtml` export.
- **Regression risk:** none at run time. It is a rename.
- **Tests that must pass:** all tests in `lib/checks/**`.

### Task D (optional): shared length rule (finding 4)

Do this only if a third check needs the same rule. Until then, the duplication is cheaper than a new helper.

## Branch protection (active since 2026-11-16)

`CLAUDE.md` and the CI file do not stop a merge by themselves. Branch protection on GitHub does. It is active on `main` since 2026-11-16, with these settings:

1. **Require a pull request before merging:** on. Nobody can push directly to `main`.
2. **Required approvals:** 0. GitHub does not let a person approve their own pull request. Set it to 1 only when a second GitHub account reviews.
3. **Required status check:** **Blocking checks**, from GitHub Actions only. **Advisory quality report** is not required.
4. **Branches must be up to date before merging:** off. Turn it on when more than one person or agent merges into `main` at the same time.
5. **Include administrators:** on. The rules also apply to the repository owner.
6. **Force pushes and deletion of `main`:** blocked.

To change these settings, open the repository on GitHub and go to **Settings > Branches**.

Dependabot alerts are on since 2026-11-16 (**Settings > Code security**). GitHub warns when a dependency has a known vulnerability. Automatic Dependabot update pull requests are not turned on.
