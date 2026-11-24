import { Link } from "react-router-dom";

import type { components } from "@/api/schema";
import { cn } from "@/lib/utils";
import { formatTaka } from "@/lib/money";

import { QueryCard } from "./QueryCard";
import { useBudgetStatus } from "./hooks";

type Level = components["schemas"]["Level"];

export const levelBar: Record<Level, string> = {
  ok: "bg-primary",
  warning: "bg-warn/100",
  over: "bg-over",
};

/** "85.0" -> "85", "34.5" -> "34.5" */
export const shortPercent = (percent: string) => percent.replace(/\.0$/, "");

export function BudgetSummaryCard({ month }: { month: string }) {
  const query = useBudgetStatus(month);
  return (
    <QueryCard title="Budget" query={query} className="md:col-span-2">
      {(status) => {
        const overall = status.overall;
        if (!overall) {
          return (
            <p className="text-sm text-muted-foreground">
              No budgets yet.{" "}
              <Link to="/budgets" className="font-medium text-primary underline">
                Set budgets
              </Link>
            </p>
          );
        }
        const over = overall.remaining.startsWith("-");
        const width = Math.min(100, Number(overall.percent));
        return (
          <div className="space-y-2">
            <p className="text-2xl font-semibold tabular-nums">
              {formatTaka(overall.spent)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                of {formatTaka(overall.limit)}
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(width)}
              aria-valuetext={`${shortPercent(overall.percent)}% used`}
              className="h-3 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full", levelBar[overall.level])}
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="flex flex-wrap justify-between gap-x-3 text-sm text-muted-foreground">
              <span>
                {over
                  ? `${formatTaka(overall.remaining.slice(1))} over budget`
                  : `${formatTaka(overall.remaining)} left`}
              </span>
              <span>
                {status.days_left} {status.days_left === 1 ? "day" : "days"} left
              </span>
            </p>
            {overall.limit_source === "sum_of_categories" && (
              <p className="text-xs text-muted-foreground">Sum of category budgets</p>
            )}
          </div>
        );
      }}
    </QueryCard>
  );
}
