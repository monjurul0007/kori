import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { CategoryTile } from "@/components/ui/category-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/ui/month-picker";
import { monthOf, todayInDhaka } from "@/lib/dates";
import { formatTaka } from "@/lib/money";

import { QueryCard } from "../dashboard/QueryCard";
import { useBudgetStatus, useSpending } from "../dashboard/hooks";
import { BudgetEditSheet, type BudgetTarget } from "./BudgetEditSheet";
import { BudgetHero } from "./BudgetHero";
import { sortCategoryBudgets } from "./budgetRows";
import { CategoryBudgetRow } from "./CategoryBudgetRow";
import { useBudgets, useExpenseCategories } from "./hooks";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** What the open sheet is for: a known target, or "pick a category to budget". */
type Editing = { kind: "target"; target: BudgetTarget } | { kind: "add" };

const OVERALL_TARGET_NAME = "Overall";

function noSpendingText(count: number) {
  return `${count} more ${count === 1 ? "category has" : "categories have"} no spending this month.`;
}

interface HeroSectionProps {
  status: ReturnType<typeof useBudgetStatus>;
  isReadOnly: boolean;
  isCurrentMonth: boolean;
  onEdit: () => void;
}

/** The hero is its own panel, so it handles loading and failure itself instead of sitting in a card. */
function BudgetHeroSection({ status, isReadOnly, isCurrentMonth, onEdit }: HeroSectionProps) {
  if (status.isPending)
    return <Skeleton aria-label="Loading monthly budget" className="h-44 w-full rounded-2xl" />;
  if (status.isError) {
    return (
      <div role="alert" className="rounded-2xl border p-5 text-sm">
        <p>Couldn&apos;t load your budget.</p>
        <Button className="mt-2" size="sm" onClick={() => void status.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <>
      <h2 className="sr-only">Overall</h2>
      <BudgetHero
        overall={status.data.overall}
        daysLeft={status.data.days_left}
        isReadOnly={isReadOnly}
        isCurrentMonth={isCurrentMonth}
        onEdit={onEdit}
      />
    </>
  );
}

export function BudgetsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("month");
  const thisMonth = monthOf(todayInDhaka());
  const month = requested && MONTH.test(requested) ? requested : thisMonth;
  // The API rejects changes to past months, so they are read-only here.
  const isReadOnly = month < thisMonth;

  const status = useBudgetStatus(month);
  const budgets = useBudgets(month);
  const spending = useSpending(month);
  const categories = useExpenseCategories();
  const [editing, setEditing] = useState<Editing>();

  const styleOf = new Map(categories.data?.map((c) => [c.id, c]));
  const budgeted = new Set(status.data?.categories.map((c) => c.category.id));
  const spentBy = new Map(spending.data?.by_category.map((c) => [c.category.id, c.amount]));
  const unbudgeted = (categories.data ?? []).filter((c) => !c.archived_at && !budgeted.has(c.id));
  const withSpending = unbudgeted.filter((c) => spentBy.has(c.id));
  const edit = (target: BudgetTarget) =>
    isReadOnly ? undefined : () => setEditing({ kind: "target", target });
  const overallTarget: BudgetTarget = {
    categoryId: null,
    name: OVERALL_TARGET_NAME,
    amount: budgets.data?.overall?.amount,
  };

  return (
    <>
      <PageHeader
        title="Budgets"
        month={month}
        actions={<MonthPicker month={month} onChange={(m) => setParams({ month: m })} />}
      />
      <div className="space-y-4">
        {isReadOnly && (
          <p className="rounded-md bg-muted p-3 text-sm">
            Past months are read-only. Budgets can only change from this month onward.
          </p>
        )}

        <BudgetHeroSection
          status={status}
          isReadOnly={isReadOnly}
          isCurrentMonth={month === thisMonth}
          onEdit={() => setEditing({ kind: "target", target: overallTarget })}
        />

        <QueryCard
          title="Category budgets"
          query={status}
          action={
            !isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-xs md:text-sm"
                onClick={() => setEditing({ kind: "add" })}
              >
                Add a category budget
              </Button>
            )
          }
        >
          {(s) =>
            s.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No category budgets yet.</p>
            ) : (
              <ul className="divide-y">
                {sortCategoryBudgets(s.categories).map((c) => (
                  <CategoryBudgetRow
                    key={c.category.id}
                    budget={c}
                    icon={styleOf.get(c.category.id)?.icon ?? null}
                    color={styleOf.get(c.category.id)?.color ?? null}
                    onEdit={edit({
                      categoryId: c.category.id,
                      name: c.category.name,
                      amount: c.limit,
                    })}
                  />
                ))}
              </ul>
            )
          }
        </QueryCard>

        {withSpending.length > 0 && (
          <QueryCard title="No budget yet" query={categories}>
            {() => (
              <>
                <ul className="divide-y">
                  {withSpending.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <CategoryTile icon={c.icon} color={c.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{c.name}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatTaka(spentBy.get(c.id) ?? "0")} spent
                        </p>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Set ${c.name} budget`}
                          onClick={() =>
                            setEditing({
                              kind: "target",
                              target: { categoryId: c.id, name: c.name },
                            })
                          }
                        >
                          Set budget
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {unbudgeted.length > withSpending.length && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {noSpendingText(unbudgeted.length - withSpending.length)}
                  </p>
                )}
              </>
            )}
          </QueryCard>
        )}

        {!isReadOnly && (
          <p className="text-xs text-muted-foreground">
            Budgets apply from the month you set them.
          </p>
        )}

        {editing && (
          <BudgetEditSheet
            key={editing.kind === "add" ? "add" : (editing.target.categoryId ?? "overall")}
            month={month}
            target={
              editing.kind === "add" ? { categoryId: null, name: "Category" } : editing.target
            }
            choices={editing.kind === "add" ? unbudgeted : undefined}
            onClose={() => setEditing(undefined)}
          />
        )}
      </div>
    </>
  );
}
