import { Money } from "@/components/ui/money";
import { fromPoisha, toPoisha } from "@/lib/money";

interface Props {
  expense: string;
  income: string;
  /** Number of matching transactions; shown as a fourth cell on desktop. */
  count?: number;
}

const CELL = "px-3 py-3 md:px-5";
const LABEL = "text-xs text-muted-foreground";
const VALUE = "block text-sm font-bold md:text-xl";

export function TotalsBar({ expense, income, count }: Props) {
  const net = fromPoisha(toPoisha(income) - toPoisha(expense));
  return (
    <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border bg-card md:grid-cols-4">
      <div className={CELL}>
        <dt className={LABEL}>Spent</dt>
        <dd>
          <Money amount={expense} className={VALUE} />
        </dd>
      </div>
      <div className={CELL}>
        <dt className={LABEL}>Income</dt>
        <dd>
          <Money amount={income} sign variant="income" className={VALUE} />
        </dd>
      </div>
      <div className={CELL}>
        <dt className={LABEL}>Net</dt>
        <dd>
          <Money amount={net} sign className={VALUE} />
        </dd>
      </div>
      {count !== undefined && (
        <div className={`hidden md:block ${CELL}`}>
          <dt className={LABEL}>Transactions</dt>
          <dd className="font-display text-xl font-bold tabular-nums">{count}</dd>
        </div>
      )}
    </dl>
  );
}
