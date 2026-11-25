import { Pencil } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatMonth, monthOf, todayInDhaka } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

import { QueryCard } from "../dashboard/QueryCard";
import { levelBar, shortPercent } from "../dashboard/BudgetSummaryCard";
import { useBudgetStatus, useSpending } from "../dashboard/hooks";
import { MonthSwitcher } from "../transactions/MonthSwitcher";
import { BudgetEditSheet, type BudgetTarget } from "./BudgetEditSheet";
import { useBudgets, useExpenseCategories } from "./hooks";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The card title already says "Overall", so its single row has a different label. */
const OVERALL_ROW_LABEL = "All spending";

const levelText = { ok: "On track", warning: "Nearly there", over: "Over budget" } as const;

/** "2026-11-01" -> "Since Nov 2026" */
function since(effectiveFrom: string) {
  const [name, year] = formatMonth(monthOf(effectiveFrom)).split(" ");
  return `Since ${name?.slice(0, 3)} ${year}`;
}

interface RowProps {
  name: string;
  limit: string;
  spent: string;
  remaining: string;
  percent: string;
  level: keyof typeof levelText;
  note?: string;
  onEdit?: () => void;
}

function BudgetRow({ name, limit, spent, remaining, percent, level, note, onEdit }: RowProps) {
  const over = remaining.startsWith("-");
  const width = Math.min(100, Number(percent));
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        <span className="tabular-nums">{formatTaka(limit)}</span>
        {onEdit && (
          <Button variant="ghost" size="icon" aria-label={`Edit ${name} budget`} onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={`${name} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${shortPercent(percent)}% used`}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", levelBar[level])}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-sm tabular-nums text-muted-foreground">
        <span>
          {formatTaka(spent)} spent ·{" "}
          {over ? `${formatTaka(remaining.slice(1))} over` : `${formatTaka(remaining)} left`}
        </span>
        <span>{levelText[level]}</span>
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </li>
  );
}

export function BudgetsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("month");
  const thisMonth = monthOf(todayInDhaka());
  const month = requested && MONTH.test(requested) ? requested : thisMonth;
  // The API rejects changes to past months, so they are read-only here.
  const readOnly = month < thisMonth;

  const status = useBudgetStatus(month);
  const budgets = useBudgets(month);
  const spending = useSpending(month);
  const categories = useExpenseCategories();
  const [editing, setEditing] = useState<BudgetTarget>();

  const effective = new Map(budgets.data?.categories.map((b) => [b.category.id, b.effective_from]));
  const budgeted = new Set(status.data?.categories.map((c) => c.category.id));
  const spentBy = new Map(spending.data?.by_category.map((c) => [c.category.id, c.amount]));
  const unbudgeted = (categories.data ?? []).filter((c) => !c.archived_at && !budgeted.has(c.id));
  const edit = (target: BudgetTarget) => (readOnly ? undefined : () => setEditing(target));

  return (
    <>
      <PageHeader title="Budgets" month={month} />
      <div className="space-y-3">
        <MonthSwitcher month={month} onChange={(m) => setParams({ month: m })} />
        {readOnly && (
          <p className="rounded-md bg-muted p-3 text-sm">
            Past months are read-only. Budgets can only change from this month onward.
          </p>
        )}

        <QueryCard title="Overall" query={status}>
          {(s) => {
            const overall = s.overall;
            const limit = budgets.data?.overall;
            const target: BudgetTarget = {
              categoryId: null,
              name: "Overall",
              amount: limit?.amount,
            };
            if (!overall) {
              return (
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Not set</span>
                  {!readOnly && (
                    <Button size="sm" onClick={() => setEditing(target)}>
                      Set overall limit
                    </Button>
                  )}
                </div>
              );
            }
            const sum = overall.limit_source === "sum_of_categories";
            return (
              <ul>
                <BudgetRow
                  name={OVERALL_ROW_LABEL}
                  {...overall}
                  note={
                    sum
                      ? `Not set · sum of categories ${formatTaka(overall.limit)}`
                      : limit
                        ? since(limit.effective_from)
                        : undefined
                  }
                  onEdit={edit(target)}
                />
              </ul>
            );
          }}
        </QueryCard>

        <QueryCard title="Categories" query={status}>
          {(s) =>
            s.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No category budgets yet.</p>
            ) : (
              <ul className="divide-y">
                {s.categories.map((c) => {
                  const from = effective.get(c.category.id);
                  return (
                    <BudgetRow
                      key={c.category.id}
                      name={c.category.name}
                      {...c}
                      note={from && since(from)}
                      onEdit={edit({
                        categoryId: c.category.id,
                        name: c.category.name,
                        amount: c.limit,
                      })}
                    />
                  );
                })}
              </ul>
            )
          }
        </QueryCard>

        {unbudgeted.length > 0 && (
          <QueryCard title="No budget" query={categories}>
            {() => (
              <ul className="divide-y">
                {unbudgeted.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatTaka(spentBy.get(c.id) ?? "0")} spent
                    </span>
                    {!readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Set ${c.name} budget`}
                        onClick={() => setEditing({ categoryId: c.id, name: c.name })}
                      >
                        Set budget
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </QueryCard>
        )}

        {editing && (
          <BudgetEditSheet
            key={editing.categoryId ?? "overall"}
            month={month}
            target={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </div>
    </>
  );
}
