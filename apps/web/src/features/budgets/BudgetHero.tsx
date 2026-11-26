import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { shortPercent } from "@/lib/budgetLevel";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

import { dailyAllowanceText } from "./budgetRows";

type Overall = components["schemas"]["OverallBudgetStatus"];

const SHELL = "rounded-2xl bg-hero p-5 text-hero-foreground md:p-6";
const HERO_BUTTON = "border-hero-foreground bg-transparent text-hero-foreground hover:bg-white/10";

interface Props {
  /** Null when no overall budget (and no category budget to add up) exists. */
  overall: Overall | null;
  daysLeft: number;
  /** Past months can't change, so the buttons go away. */
  isReadOnly: boolean;
  isCurrentMonth: boolean;
  onEdit: () => void;
}

function daysLeftText(daysLeft: number) {
  return `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
}

/** The month's one headline: how much of the overall budget is left. */
export function BudgetHero({ overall, daysLeft, isReadOnly, isCurrentMonth, onEdit }: Props) {
  if (!overall) {
    return (
      <section aria-label="Monthly budget" className={SHELL}>
        <p className="text-sm text-hero-muted">Monthly budget</p>
        <p className="mt-2 text-lg">No monthly budget yet.</p>
        {!isReadOnly && (
          <Button variant="outline" className={`mt-4 ${HERO_BUTTON}`} onClick={onEdit}>
            Set a monthly budget
          </Button>
        )}
      </section>
    );
  }

  const leftPoisha = toPoisha(overall.remaining);
  const isOver = leftPoisha < 0n;
  const barPercent = Math.min(100, Number(overall.percent));
  const allowance = isCurrentMonth ? dailyAllowanceText(overall.remaining, daysLeft) : null;
  return (
    <section aria-label="Monthly budget" className={SHELL}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-hero-muted">Monthly budget</p>
        {!isReadOnly && (
          <Button size="sm" variant="outline" className={HERO_BUTTON} onClick={onEdit}>
            Change limit
          </Button>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <Money
          amount={fromPoisha(isOver ? -leftPoisha : leftPoisha)}
          className="text-5xl font-bold leading-none"
        />
        <span className="text-sm text-hero-muted">
          {isOver ? "over" : "left of"} {formatTaka(overall.limit)}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="Monthly budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barPercent)}
        aria-valuetext={`${shortPercent(overall.percent)}% used`}
        className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/20"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${barPercent}%` }} />
      </div>
      <p className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-hero-muted">
        <span>{formatTaka(overall.spent)} spent</span>
        {isCurrentMonth && daysLeft > 0 && <span>{daysLeftText(daysLeft)}</span>}
      </p>
      {allowance && <p className="mt-3 text-sm text-hero-muted">{allowance}</p>}
      {overall.limit_source === "sum_of_categories" && (
        <p className="mt-1 text-xs text-hero-muted">
          Not set. Adding up your category budgets instead.
        </p>
      )}
    </section>
  );
}
