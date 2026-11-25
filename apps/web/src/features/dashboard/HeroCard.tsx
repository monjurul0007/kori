import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { shortPercent } from "@/lib/budgetLevel";
import { monthName } from "@/lib/dates";

import { computeHero } from "./hero";
import { useBudgetStatus, useSpending } from "./hooks";

const SHELL = "rounded-2xl bg-hero p-5 text-hero-foreground md:p-6";

function plural(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

function HeroError({ onRetry }: { onRetry: () => void }) {
  return (
    <section aria-label="Left to spend" role="alert" className={SHELL}>
      <p>Couldn&apos;t load your budget.</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 border-hero-foreground text-hero-foreground hover:bg-white/10"
        onClick={onRetry}
      >
        Try again
      </Button>
    </section>
  );
}

function HeroLoading() {
  return (
    <section aria-label="Left to spend" className={SHELL}>
      <Skeleton aria-label="Loading left to spend" className="h-32 w-full bg-white/10" />
    </section>
  );
}

/** The answer to "how much can I still spend this month?"; without a budget, how much was spent. */
export function HeroCard({ month }: { month: string }) {
  const status = useBudgetStatus(month);
  const spending = useSpending(month);
  const name = monthName(month);

  if (status.isError) return <HeroError onRetry={() => void status.refetch()} />;
  if (!status.data) return <HeroLoading />;

  const overall = status.data.overall;
  if (!overall) {
    if (spending.isError) return <HeroError onRetry={() => void spending.refetch()} />;
    if (!spending.data) return <HeroLoading />;
    return (
      <section aria-label={`Spent in ${name}`} className={SHELL}>
        <p className="text-sm text-hero-muted">Spent in {name}</p>
        <p className="mt-2 font-display text-5xl font-bold leading-none tabular-nums">
          <Money amount={spending.data.total} />
        </p>
        <Link
          to="/budgets"
          className="mt-5 inline-block text-sm font-medium text-hero-foreground underline underline-offset-4"
        >
          Set a monthly budget
        </Link>
      </section>
    );
  }

  const hero = computeHero(overall, { month, monthName: name, daysLeft: status.data.days_left });
  const daysLeft = status.data.days_left;
  return (
    <section aria-label="Left to spend" className={SHELL}>
      <p className="text-sm text-hero-muted">
        {hero.isOver ? `Over budget in ${name}` : `Left to spend in ${name}`}
      </p>
      <p className="mt-2 font-display text-5xl font-bold leading-none tabular-nums">
        <Money amount={hero.amount} />
        {hero.isOver && <span className="ml-2 text-2xl font-semibold"> over</span>}
      </p>
      <div
        role="progressbar"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hero.barPercent)}
        aria-valuetext={`${shortPercent(overall.percent)}% used`}
        className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/20"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${hero.barPercent}%` }} />
      </div>
      <p className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-hero-muted">
        <span>{hero.spentOfLimit}</span>
        {daysLeft > 0 && <span>{plural(daysLeft)}</span>}
      </p>
      {hero.isOver && (
        <p className="mt-3 text-sm text-hero-muted">You&apos;re past your {name} budget.</p>
      )}
      {hero.dailyAllowance && <p className="mt-3 text-sm text-hero-muted">{hero.dailyAllowance}</p>}
      {overall.limit_source === "sum_of_categories" && (
        <p className="mt-1 text-xs text-hero-muted">Sum of category budgets</p>
      )}
    </section>
  );
}
