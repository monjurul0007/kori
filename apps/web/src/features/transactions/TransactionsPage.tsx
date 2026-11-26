import { Download, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { ShellContext } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthPicker } from "@/components/ui/month-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth, monthOf, todayInDhaka } from "@/lib/dates";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

import { DayGroup } from "./DayGroup";
import { TransactionSheet } from "./form/TransactionSheet";
import { FilterSheet } from "./FilterSheet";
import { InlineFilters, TypeChips } from "./FilterControls";
import { SearchInput } from "./SearchInput";
import { TotalsBar } from "./TotalsBar";
import type { Transaction } from "./TransactionRow";
import { exportHref, NO_FILTERS, useFilters } from "./filters";
import { MIN_SEARCH_LENGTH, useCategories, usePaymentMethods, useTransactions } from "./hooks";

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-3 pr-0.5 text-sm text-brand-text">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-background/60"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

interface EmptyListProps {
  month: string;
  searchText: string;
  hasActiveFilters: boolean;
  otherFiltersActive: boolean;
  onClear: () => void;
  onAdd: () => void;
}

/** Says why the list is empty: a no-match search or filter, a future month, or a quiet month. */
function EmptyListState({
  month,
  searchText,
  hasActiveFilters,
  otherFiltersActive,
  onClear,
  onAdd,
}: EmptyListProps) {
  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        message={
          otherFiltersActive
            ? "No transactions match these filters"
            : `No transactions match "${searchText}"`
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            {otherFiltersActive ? "Clear filters" : "Clear search"}
          </Button>
        }
      />
    );
  }
  if (month > monthOf(todayInDhaka())) {
    return <EmptyState message="This month hasn't started yet." />;
  }
  return (
    <EmptyState
      message={`No transactions in ${formatMonth(month).split(" ")[0]}.`}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add one
        </Button>
      }
    />
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

  const searchText = filters.q.trim();
  const searchActive = searchText.length >= MIN_SEARCH_LENGTH;
  const otherFiltersActive =
    !!filters.type || filters.categoryIds.length > 0 || !!filters.paymentMethodId || !!filters.tag;
  const hasActiveFilters = searchActive || otherFiltersActive;
  const clearAll = () => update(NO_FILTERS);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [editing, setEditing] = useState<Transaction>();

  return (
    <>
      <PageHeader
        title="Transactions"
        month={filters.month}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MonthPicker month={filters.month} onChange={(month) => update({ month })} />
            <Button asChild variant="outline" size="sm">
              <a href={exportHref(filters)} download>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Export CSV</span>
              </a>
            </Button>
          </div>
        }
      />
      <div className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <SearchInput value={filters.q} onChange={(q) => update({ q })} />
          {isDesktop ? (
            <InlineFilters filters={filters} onChange={update} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <TypeChips filters={filters} onChange={update} />
              <FilterSheet filters={filters} onChange={update} onClearAll={clearAll} />
            </div>
          )}
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
        {searchText.length > 0 && !searchActive && (
          <p className="text-sm text-muted-foreground">
            Type at least {MIN_SEARCH_LENGTH} characters to search
          </p>
        )}
        <div
          className={`space-y-3 transition-opacity ${query.isPlaceholderData ? "pointer-events-none opacity-60" : ""}`}
          aria-busy={query.isPlaceholderData}
        >
          {totals && (
            <TotalsBar expense={totals.expense} income={totals.income} count={totals.count} />
          )}

          {query.isPending && (
            <div className="space-y-2" aria-label="Loading transactions">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
          {query.isError && (
            <EmptyState
              variant="error"
              message={
                query.error instanceof ApiError
                  ? query.error.message
                  : "Couldn't load transactions."
              }
              action={
                <Button size="sm" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          )}
          {query.isSuccess && !query.isPlaceholderData && groups.length === 0 && (
            <EmptyListState
              month={filters.month}
              searchText={searchText}
              hasActiveFilters={hasActiveFilters}
              otherFiltersActive={otherFiltersActive}
              onClear={clearAll}
              onAdd={openAdd}
            />
          )}
          {groups.map(([date, items]) => (
            <DayGroup
              key={date}
              date={date}
              transactions={items}
              onSelect={setEditing}
              categories={categories}
            />
          ))}
        </div>
        <div ref={sentinel} aria-hidden="true" />
        {isFetchingNextPage && <Skeleton className="h-14 w-full" />}
        <TransactionSheet
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(undefined)}
          transaction={editing}
        />
      </div>
    </>
  );
}
