# Implementation review: <task name>

Use this template for a significant change only. Do not use it for a small fix. Copy it into the pull request description, or into `docs/reviews/YYYY-MM-DD-<task>.md` when the change has no pull request.

## Before implementation

- **Task objective:**
- **Existing functionality reviewed:** <files and modules that you read>
- **Components or utilities available for reuse:**
- **Proposed changes:** <files to create and files to change>
- **Architecture impact:** <module boundaries affected. ADR needed: Yes / No>
- **Risks:**

## After implementation

- **What was changed:**
- **Files modified:**
- **Existing functionality reused:**
- **New dependencies introduced:** <name, version, reason, or "None">
- **Tests executed and results:** <command and result, for example "npm run test: 834 passed">
- **Static analysis results:** <lint, typecheck, complexity warnings in changed files>
- **Duplication check:** <`npm run quality` result for changed files>
- **Security and performance observations:**
- **Outstanding concerns:**
- **Human approval required:** Yes / No <Yes for architecture, security, database migration, or breaking changes>
