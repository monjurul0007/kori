import { AlertTriangle, OctagonAlert } from "lucide-react";

import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

import { shortPercent } from "./BudgetSummaryCard";
import { useBudgetStatus } from "./hooks";

/** One line per category at warning or over. Renders nothing while loading, on error or when all is well. */
export function BudgetWarnings({ month }: { month: string }) {
  const status = useBudgetStatus(month).data;
  const flagged = status?.categories.filter((c) => c.level !== "ok") ?? [];
  if (!status || flagged.length === 0) return null;
  const left = `${status.days_left} ${status.days_left === 1 ? "day" : "days"} left`;
  return (
    <ul aria-label="Budget warnings" className="space-y-2 md:col-span-2">
      {flagged.map((c) => {
        const over = c.level === "over";
        const Icon = over ? OctagonAlert : AlertTriangle;
        return (
          <li
            key={c.category.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm",
              over
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-amber-300 bg-amber-50 text-amber-900",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{over ? "Over budget: " : "Warning: "}</span>
              {c.category.name} is at {shortPercent(c.percent)}% of {formatTaka(c.limit)} with{" "}
              {left}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
