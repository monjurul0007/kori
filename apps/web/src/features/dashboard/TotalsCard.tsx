import { Money } from "@/components/ui/money";
import { addMonths, monthName, monthOf, todayInDhaka } from "@/lib/dates";
import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

import { QueryCard } from "./QueryCard";
import { useTrend } from "./hooks";

interface RowProps {
  label: string;
  context: string;
  children: React.ReactNode;
}

function TotalRow({ label, context, children }: RowProps) {
  return (
    <div className="flex flex-col gap-1 border-l pl-3 first:border-l-0 first:pl-0 md:flex-row md:items-baseline md:justify-between md:gap-3 md:border-l-0 md:border-t md:py-3 md:pl-0 md:first:pt-0 md:last:pb-0">
      <div className="min-w-0 md:order-first">
        <dt className="text-sm">{label}</dt>
        <dd className="hidden text-xs text-muted-foreground md:block">{context}</dd>
      </div>
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums md:text-xl">{children}</p>
    </div>
  );
}

/** Spent, income and net for the month, always visible, with last month's spending for context. */
export function TotalsCard({ month }: { month: string }) {
  const query = useTrend(month);
  return (
    <QueryCard title="Totals" hideTitle query={query}>
      {({ months }) => {
        const current = months.find((m) => m.month === month);
        const previous = months.find((m) => m.month === addMonths(month, -1));
        const expense = current?.expense ?? "0";
        const income = current?.income ?? "0";
        const net = fromPoisha(toPoisha(income) - toPoisha(expense));
        const isNegative = toPoisha(net) < 0n;
        const isCurrentMonth = month === monthOf(todayInDhaka());
        const name = monthName(month);
        return (
          <dl className="grid grid-cols-3 md:block">
            <TotalRow
              label="Spent"
              context={
                previous
                  ? `${monthName(previous.month)} total: ${formatTaka(previous.expense)}`
                  : `Spent in ${name}`
              }
            >
              <Money amount={expense} />
            </TotalRow>
            <TotalRow label="Income" context={`Earned in ${name}`}>
              <Money amount={income} sign variant="income" />
            </TotalRow>
            <TotalRow
              label="Net"
              context={
                isNegative
                  ? "Spent more than earned"
                  : isCurrentMonth
                    ? "Kept so far this month"
                    : `Kept in ${name}`
              }
            >
              <Money amount={net} sign />
            </TotalRow>
          </dl>
        );
      }}
    </QueryCard>
  );
}
