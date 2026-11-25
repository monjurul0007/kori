import type { components } from "@/api/schema";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

type CategoryStatus = components["schemas"]["CategoryBudgetStatus"];

export type AttentionKind = "over" | "near-limit" | "fully-used";

export interface AttentionItem {
  kind: AttentionKind;
  categoryId: string;
  /** The bold lead-in, e.g. "Food & Dining is ৳150 over". */
  lead: string;
  /** The rest of the sentence. */
  rest: string;
}

const KIND_ORDER: Record<AttentionKind, number> = { over: 0, "near-limit": 1, "fully-used": 2 };

function kindOf(c: CategoryStatus): AttentionKind | null {
  const remaining = toPoisha(c.remaining);
  if (remaining < 0n) return "over";
  // The API calls exactly 100% "over", but nothing is overspent: the budget is just used up.
  if (remaining === 0n) return "fully-used";
  return c.level === "ok" ? null : "near-limit";
}

function describe(c: CategoryStatus, kind: AttentionKind, daysLeft: number): AttentionItem {
  const name = c.category.name;
  const limit = formatTaka(c.limit);
  const base = { kind, categoryId: c.category.id };
  if (kind === "over") {
    const over = formatTaka(fromPoisha(-toPoisha(c.remaining)));
    return { ...base, lead: `${name} is ${over} over`, rest: ` its ${limit} budget.` };
  }
  if (kind === "fully-used") {
    return { ...base, lead: `${name} is fully used.`, rest: ` Its ${limit} budget is spent.` };
  }
  const window = daysLeft > 0 ? ` for the last ${daysLeft === 1 ? "day" : `${daysLeft} days`}` : "";
  return { ...base, lead: `${name} has ${formatTaka(c.remaining)} left`, rest: `${window}.` };
}

/** Over-budget first, then near the limit, then fully used; within each, the fullest budget first. */
export function buildAttention(categories: CategoryStatus[], daysLeft: number): AttentionItem[] {
  return categories
    .flatMap((c) => {
      const kind = kindOf(c);
      return kind ? [{ c, kind }] : [];
    })
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || Number(b.c.percent) - Number(a.c.percent),
    )
    .map(({ c, kind }) => describe(c, kind, daysLeft));
}
