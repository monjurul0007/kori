import { addDays, formatDisplayDate } from "@/lib/dates";
import { fromPoisha, toPoisha } from "@/lib/money";

import type { Transaction } from "../transactions/TransactionRow";

export interface DayGroup {
  date: string;
  /** "Today", "Yesterday", or "Mon, 28 Sep". */
  label: string;
  /** Total expenses of the day in taka, as a decimal string. */
  spent: string;
  transactions: Transaction[];
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatDisplayDate(date);
}

/** Groups transactions that are already newest-first into days, keeping their order. */
export function groupByDay(transactions: Transaction[], today: string): DayGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const t of transactions)
    byDate.set(t.occurred_on, [...(byDate.get(t.occurred_on) ?? []), t]);
  return [...byDate.entries()].map(([date, items]) => ({
    date,
    label: dayLabel(date, today),
    spent: fromPoisha(
      items.filter((t) => t.type === "expense").reduce((sum, t) => sum + toPoisha(t.amount), 0n),
    ),
    transactions: items,
  }));
}
