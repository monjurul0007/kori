# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-09-28
- Refs: M1-01

## Context

Kori is built across many short, independent sessions: one Trello card, one PR. Some of those
sessions are AI-assisted. Nobody carries the full history of a decision in their head. Without a
written record, decisions get re-argued or quietly undone.

## Decision

We record significant, hard-to-reverse decisions as Architecture Decision Records in `docs/adr/`,
using the Nygard format (Status, Context, Decision, Consequences).

- **Numbering:** sequential numbers, never reused.
- **Changing a decision:** accepted ADRs aren't edited in substance. A new ADR supersedes the old
  one.
- **Spikes:** every spike on the board ends in an ADR (or a short doc) so its outcome is findable.
- **Review:** ADRs are reviewed in PRs like code.

## Consequences

- New sessions and new contributors can learn why things are as they are by reading `docs/adr/`.
- Writing an ADR costs a little time for each important choice.
- `AGENTS.md` (which `CLAUDE.md` imports) and `CONTRIBUTING.md` point here, so every AI agent
  picks up the same constraints.
