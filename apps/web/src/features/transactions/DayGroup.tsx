import { formatDisplayDate } from "@/lib/dates";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

import { TransactionRow, type Transaction } from "./TransactionRow";

interface Props {
  date: string;
  transactions: Transaction[];
  onSelect: (transaction: Transaction) => void;
}

export function DayGroup({ date, transactions, onSelect }: Props) {
  const spent = fromPoisha(
    transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + toPoisha(t.amount), 0n),
  );
  return (
    <section aria-label={formatDisplayDate(date)} className="rounded-lg border bg-background">
      <header className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <h2>{formatDisplayDate(date)}</h2>
        <span>{formatTaka(spent)}</span>
      </header>
      <ul className="divide-y">
        {transactions.map((t) => (
          <TransactionRow key={t.id} transaction={t} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}
