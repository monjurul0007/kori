import { useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { TransactionSheet } from "../transactions/form/TransactionSheet";
import { useTransactions } from "../transactions/hooks";
import { TransactionRow, type Transaction } from "../transactions/TransactionRow";

const RECENT = 5;

export function RecentTransactions({ month }: { month: string }) {
  const query = useTransactions({ month, categoryIds: [], q: "" });
  const [editing, setEditing] = useState<Transaction>();
  const items = query.data?.pages[0]?.items.slice(0, RECENT) ?? [];
  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <Link to={`/transactions?month=${month}`} className="text-sm font-medium text-primary">
          See all
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        {query.isPending && (
          <Skeleton aria-label="Loading recent transactions" className="mx-3 h-24" />
        )}
        {query.isError && (
          <div role="alert" className="px-3 text-sm">
            <p>Couldn&apos;t load recent transactions.</p>
            <Button className="mt-2" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {query.isSuccess && items.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">No transactions this month.</p>
        )}
        {items.length > 0 && (
          <ul className="divide-y">
            {items.map((t) => (
              <TransactionRow key={t.id} transaction={t} onSelect={setEditing} />
            ))}
          </ul>
        )}
      </CardContent>
      <TransactionSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        transaction={editing}
      />
    </Card>
  );
}
