import type { components } from "@/api/schema";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

import { dailyAllowanceTaka } from "../dashboard/hero";

type CategoryStatus = components["schemas"]["CategoryBudgetStatus"];

/** From this share of the limit a bar turns marigold. */
export const NEAR_LIMIT_PERCENT = 85;

export type RowState = "over" | "fully-used" | "near-limit" | "on-track";

export interface RowStatus {
  state: RowState;
  /** The status in words, so colour is never the only signal. */
  label: string;
}

/** The API calls exactly 100% "over", but nothing is overspent then: the budget is just used up. */
export function rowStatus(c: Pick<CategoryStatus, "remaining" | "percent">): RowStatus {
  const remaining = toPoisha(c.remaining);
  if (remaining < 0n) return { state: "over", label: `${formatTaka(fromPoisha(-remaining))} over` };
  if (remaining === 0n) return { state: "fully-used", label: "Fully used" };
  const state = Number(c.percent) >= NEAR_LIMIT_PERCENT ? "near-limit" : "on-track";
  return { state, label: `${formatTaka(c.remaining)} left` };
}

const RANK: Record<RowState, number> = { over: 0, "near-limit": 1, "fully-used": 2, "on-track": 2 };

/** Over budget first, then near the limit, then the rest in the API's order. */
export function sortCategoryBudgets(categories: CategoryStatus[]): CategoryStatus[] {
  return categories
    .map((category, index) => ({ category, index, rank: RANK[rowStatus(category).state] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ category }) => category);
}

/** "Spend up to ৳2,108 a day to stay on budget.", or null when it doesn't apply. */
export function dailyAllowanceText(remaining: string, daysLeft: number): string | null {
  const allowance = dailyAllowanceTaka(toPoisha(remaining), daysLeft);
  return allowance === null
    ? null
    : `Spend up to ${formatTaka(String(allowance))} a day to stay on budget.`;
}
