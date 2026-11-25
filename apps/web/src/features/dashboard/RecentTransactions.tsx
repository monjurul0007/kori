import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CategoryTile } from "@/components/ui/category-tile";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { todayInDhaka } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { TransactionSheet } from "../transactions/form/TransactionSheet";
import { useCategories, useTransactions } from "../transactions/hooks";
import type { Transaction } from "../transactions/TransactionRow";
import { groupByDay, limitRows } from "./recentGroups";

const RECENT = 6;

function RecentRow({
  transaction: t,
  onSelect,
}: {
  transaction: Transaction;
  onSelect: (t: Transaction) => void;
}) {
  const categories = useCategories().data;
  const first = t.lines[0]?.category;
  const style = categories?.find((c) => c.id === first?.id);
  const title = t.merchant || t.note || first?.name || "Transaction";
  const category = t.is_split
    ? `Split · ${t.lines.length} categories`
    : (first?.name ?? "Uncategorised");
  const income = t.type === "income";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(t)}
        className="flex min-h-11 w-full items-center gap-3 border-t py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CategoryTile icon={style?.icon ?? null} color={style?.color ?? null} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[category, t.payment_method?.name].filter(Boolean).join(", ")}
          </span>
        </span>
        <Money
          amount={t.amount}
          sign={income}
          variant={income ? "income" : "default"}
          className="shrink-0 text-sm font-semibold"
        />
      </button>
    </li>
  );
}

export function RecentTransactions({ month, className }: { month: string; className?: string }) {
  const query = useTransactions({ month, categoryIds: [], q: "" });
  const [editing, setEditing] = useState<Transaction>();
  const items = query.data?.pages[0]?.items ?? [];
  const groups = limitRows(groupByDay(items, todayInDhaka()), RECENT);
  return (
    <section
      aria-labelledby="recent-heading"
      className={cn("rounded-2xl border bg-card p-5", className)}
    >
      <div className="flex items-center justify-between">
        <h2 id="recent-heading" className="text-base font-semibold">
          Recent
        </h2>
        <Link to={`/transactions?month=${month}`} className="text-sm font-medium text-brand-text">
          See all transactions
        </Link>
      </div>
      {query.isPending && (
        <Skeleton aria-label="Loading recent transactions" className="mt-3 h-24" />
      )}
      {query.isError && (
        <div role="alert" className="mt-3 text-sm">
          <p>Couldn&apos;t load recent transactions.</p>
          <Button className="mt-2" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {query.isSuccess && groups.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No transactions this month.</p>
      )}
      {groups.map((group) => (
        <div key={group.date} className="mt-3">
          <p className="flex justify-between pb-1 text-xs text-muted-foreground">
            <span>{group.label}</span>
            <span>
              Spent <Money amount={group.spent} className="font-sans" />
            </span>
          </p>
          <ul>
            {group.transactions.map((t) => (
              <RecentRow key={t.id} transaction={t} onSelect={setEditing} />
            ))}
          </ul>
        </div>
      ))}
      <TransactionSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        transaction={editing}
      />
    </section>
  );
}
