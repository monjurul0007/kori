import type { components } from "@/api/schema";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

export type Transaction = components["schemas"]["TransactionOut"];

interface Props {
  transaction: Transaction;
  onSelect: (transaction: Transaction) => void;
}

const MAX_TAGS = 2;

export function TransactionRow({ transaction: t, onSelect }: Props) {
  const title = t.merchant || t.note || t.lines[0]?.category.name || "Transaction";
  const category = t.is_split
    ? `Split · ${t.lines.length} categories`
    : (t.lines[0]?.category.name ?? "Uncategorised");
  const extra = t.tags.length - MAX_TAGS;
  const income = t.type === "income";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(t)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{category}</span>
            {t.payment_method && <span>{t.payment_method.name}</span>}
            {t.tags.slice(0, MAX_TAGS).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
            {extra > 0 && <span>+{extra}</span>}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            income && "text-emerald-600",
          )}
        >
          {income ? "+" : ""}
          {formatTaka(t.amount)}
        </span>
      </button>
    </li>
  );
}
