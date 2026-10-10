import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { ShellContext } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth } from "@/lib/dates";

import { DayGroup } from "./DayGroup";
import { FilterSheet } from "./FilterSheet";
import { MonthSwitcher } from "./MonthSwitcher";
import { SearchInput } from "./SearchInput";
import { TotalsBar } from "./TotalsBar";
import type { Transaction } from "./TransactionRow";
import { useFilters } from "./filters";
import { useCategories, usePaymentMethods, useTransactions } from "./hooks";

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="rounded-full p-1 hover:bg-background"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

export function TransactionsPage() {
  const { openAdd } = useOutletContext<ShellContext>();
  const { filters, update } = useFilters();
  const query = useTransactions(filters);
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const page of query.data?.pages ?? []) {
      for (const t of page.items)
        byDate.set(t.occurred_on, [...(byDate.get(t.occurred_on) ?? []), t]);
    }
    return [...byDate.entries()];
  }, [query.data]);

  const totals = query.data?.pages[0]?.totals;
  const chips = [
    filters.type && {
      label: filters.type === "expense" ? "Expenses" : "Income",
      clear: { type: undefined },
    },
    ...filters.categoryIds.map((id) => ({
      label: categories.find((c) => c.id === id)?.name ?? "Category",
      clear: { categoryIds: filters.categoryIds.filter((c) => c !== id) },
    })),
    filters.paymentMethodId && {
      label: methods.find((m) => m.id === filters.paymentMethodId)?.name ?? "Payment method",
      clear: { paymentMethodId: undefined },
    },
    filters.tag && { label: `#${filters.tag}`, clear: { tag: undefined } },
  ].filter((chip) => !!chip);

  // M1-14 wires the tap to the edit form; until then it is a deliberate no-op.
  const onSelect = () => {};

  return (
    <>
      <PageHeader title="Transactions" />
      <div className="space-y-3">
        <MonthSwitcher month={filters.month} onChange={(month) => update({ month })} />
        <div className="flex items-center gap-2">
          <SearchInput value={filters.q} onChange={(q) => update({ q })} />
          <FilterSheet filters={filters} onChange={update} />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <RemovableChip
                key={chip.label}
                label={chip.label}
                onRemove={() => update(chip.clear)}
              />
            ))}
          </div>
        )}
        {totals && <TotalsBar expense={totals.expense} income={totals.income} />}

        {query.isPending && (
          <div className="space-y-2" aria-label="Loading transactions">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {query.isError && (
          <div role="alert" className="rounded-lg border p-4 text-sm">
            <p>
              {query.error instanceof ApiError
                ? query.error.message
                : "Couldn't load transactions."}
            </p>
            <Button className="mt-2" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {query.isSuccess && groups.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No transactions in {formatMonth(filters.month).split(" ")[0]}.{" "}
            <button type="button" onClick={openAdd} className="font-medium text-primary underline">
              Add one
            </button>
          </p>
        )}
        {groups.map(([date, items]) => (
          <DayGroup key={date} date={date} transactions={items} onSelect={onSelect} />
        ))}
        <div ref={sentinel} aria-hidden="true" />
        {isFetchingNextPage && <Skeleton className="h-14 w-full" />}
      </div>
    </>
  );
}
