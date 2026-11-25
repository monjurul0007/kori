import type { components } from "@/api/schema";
import { monthOf, todayInDhaka } from "@/lib/dates";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

type Overall = components["schemas"]["OverallBudgetStatus"];

export interface Hero {
  /** Remaining taka (never negative). */
  amount: string;
  isOver: boolean;
  /** Share of the budget used, 0 to 100, for the bar. */
  barPercent: number;
  /** "৳27,350 of ৳40,000 spent" */
  spentOfLimit: string;
  /** "Spend up to ৳2,108 a day to finish November on budget.", or null when it doesn't apply. */
  dailyAllowance: string | null;
}

const POISHA_PER_TAKA = 100n;

/** Whole taka you can spend each remaining day, rounded down; null when there is no sensible figure. */
function dailyAllowancePoisha(leftPoisha: bigint, daysLeft: number): bigint | null {
  if (leftPoisha <= 0n || daysLeft < 1) return null;
  return leftPoisha / POISHA_PER_TAKA / BigInt(daysLeft);
}

export function computeHero(
  overall: Overall,
  opts: { month: string; monthName: string; daysLeft: number; today?: string },
): Hero {
  const { month, monthName, daysLeft, today = todayInDhaka() } = opts;
  const leftPoisha = toPoisha(overall.remaining);
  const isOver = leftPoisha < 0n;
  const isCurrentMonth = month === monthOf(today);
  const allowance = isCurrentMonth ? dailyAllowancePoisha(leftPoisha, daysLeft) : null;
  return {
    amount: fromPoisha(isOver ? -leftPoisha : leftPoisha),
    isOver,
    barPercent: Math.min(100, Number(overall.percent)),
    spentOfLimit: `${formatTaka(overall.spent)} of ${formatTaka(overall.limit)} spent`,
    dailyAllowance:
      allowance === null
        ? null
        : `Spend up to ${formatTaka(String(allowance))} a day to finish ${monthName} on budget.`,
  };
}
