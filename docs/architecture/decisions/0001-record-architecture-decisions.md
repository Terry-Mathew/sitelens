# ADR-0001: Record architecture decisions

- **Date:** 2026-11-16
- **Status:** Accepted
- **Decided by:** founder (request of 2026-11-16)

## Context and problem

AI coding agents build SiteLens. An agent does not remember earlier sessions. Without a written record, a new agent can reverse a decision, or add a second solution for a problem that the project already solved.

The v1 decisions before this date are in the product requirements, mainly in Section 17 of `docs/superpowers/specs/2026-11-15-sitelens-mvp-design.md`. This ADR does not repeat them.

## Options considered

1. **Keep decisions only in the PRD.** Simple. But the PRD mixes product rules and technical choices, and it does not show which decisions replace which.
2. **Lightweight ADRs in the repository.** One short file for each decision, with a status. Agents can find them with a file search.
3. **An external wiki or tool.** Agents cannot read it reliably, and it needs an extra account.

## Decision and rationale

Option 2. Each significant decision gets one file in `docs/architecture/decisions/`, made from `ADR_TEMPLATE.md`. `CLAUDE.md` tells agents when an ADR is necessary. A decision stays "Proposed" until the founder approves it.

## Consequences and trade-offs

- Agents must read the ADR list at the start of a session.
- An ADR costs a few minutes for each significant change.
- The PRD stays the source of product requirements. An ADR records the technical choice and its reason.

## Related files or components

- `CLAUDE.md`, section "Architecture decision records (ADRs)"
- `docs/architecture/decisions/ADR_TEMPLATE.md`
