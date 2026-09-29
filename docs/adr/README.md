# Architecture Decision Records

We record significant, hard-to-reverse decisions as short ADRs in the
[Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
Status, Context, Decision and Consequences.

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-tech-stack.md) | Tech stack | Accepted |
| [0003](0003-two-repo-split.md) | Two repositories: `kori` and `kori-ai` | Accepted |
| [0004](0004-money-and-dates.md) | Money and date representation | Accepted |

**Upcoming**, from the spikes on the Trello board:
- 0005: hosting (S2)
- 0006: background jobs (S3)
- 0007: the AI integration contract (S1)

## Writing a new ADR

1. Copy the template below to `NNNN-short-title.md`, using the next number.
2. Keep it to about one page. Link the Trello card or spike that prompted it.
3. Open a PR with the `docs` scope, e.g. `docs: add ADR-0005 hosting`.
4. To change a decision, add a new ADR that supersedes the old one, and mark the old one
   `Superseded by NNNN`. Don't rewrite accepted ADRs.

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Refs: <card or spike>

## Context
## Decision
## Consequences
```
