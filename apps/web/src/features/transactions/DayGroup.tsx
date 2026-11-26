import type { ComponentProps } from "react";

import { formatDayHeading, todayInDhaka } from "@/lib/dates";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

import { TransactionRow, type Transaction } from "./TransactionRow";

interface Props {
  date: string;
  transactions: Transaction[];
  onSelect: (transaction: Transaction) => void;
  categories?: ComponentProps<typeof TransactionRow>["categories"];
  /** The current date in Dhaka; only tests pass this. */
  today?: string;
}

export function DayGroup({
  date,
  transactions,
  onSelect,
  categories,
  today = todayInDhaka(),
}: Props) {
  const heading = formatDayHeading(date, today);
  const total = (type: Transaction["type"]) =>
    transactions.filter((t) => t.type === type).reduce((sum, t) => sum + toPoisha(t.amount), 0n);
  const spentPoisha = total("expense");
  const incomePoisha = total("income");
  const spent = formatTaka(fromPoisha(spentPoisha));
  const income = formatTaka(fromPoisha(incomePoisha));
  // An income-only day shows no "Spent" figure, so the two never contradict.
  const showSpent = spentPoisha > 0n || incomePoisha === 0n;
  const showIncome = incomePoisha > 0n;
  const summary = [showSpent && `spent ${spent}`, showIncome && `income ${income}`]
    .filter(Boolean)
    .join(", ");
  return (
    <section aria-label={heading} className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2.5 text-xs text-muted-foreground">
        <h2 className="font-display text-sm font-bold text-foreground">{heading}</h2>
        <span className="sr-only">{`${heading}: ${summary}`}</span>
        <span aria-hidden="true" className="flex gap-3 tabular-nums">
          {showSpent && <span>{`Spent ${spent}`}</span>}
          {showIncome && <span className="text-income">{`+${income} in`}</span>}
        </span>
      </header>
      <ul className="divide-y">
        {transactions.map((t) => (
          <TransactionRow key={t.id} transaction={t} onSelect={onSelect} categories={categories} />
        ))}
      </ul>
    </section>
  );
}
