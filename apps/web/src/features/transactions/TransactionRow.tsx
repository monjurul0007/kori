import { Repeat, Split } from "lucide-react";

import type { components } from "@/api/schema";
import { CategoryTile } from "@/components/ui/category-tile";
import { Money } from "@/components/ui/money";

export type Transaction = components["schemas"]["TransactionOut"];
type CategoryStyle = Pick<components["schemas"]["CategoryOut"], "id" | "icon" | "color">;

interface Props {
  transaction: Transaction;
  onSelect: (transaction: Transaction) => void;
  /** Category list, used to look up each row's icon and colour. */
  categories?: CategoryStyle[];
}

const MAX_TAGS = 2;

export function TransactionRow({ transaction: t, onSelect, categories = [] }: Props) {
  const firstCategory = t.lines[0]?.category;
  const title = t.merchant || t.note || firstCategory?.name || "Transaction";
  const category = t.is_split
    ? `Split · ${t.lines.length} categories`
    : (firstCategory?.name ?? "Uncategorised");
  const style = categories.find((c) => c.id === firstCategory?.id);
  const extra = t.tags.length - MAX_TAGS;
  const income = t.type === "income";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(t)}
        className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[auto_minmax(0,1fr)_9rem_11rem_7rem]"
      >
        {t.is_split ? (
          <span
            aria-hidden="true"
            className="row-span-2 grid h-9 w-9 place-items-center rounded-[10px] bg-muted text-muted-foreground"
          >
            <Split className="h-4 w-4" />
          </span>
        ) : (
          <CategoryTile
            icon={style?.icon ?? null}
            color={style?.color ?? null}
            className="row-span-2 h-9 w-9"
          />
        )}
        <p className="flex items-center gap-1 text-sm font-medium">
          <span className="truncate">{title}</span>
          {t.source === "recurring" && (
            <Repeat
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              role="img"
              aria-label="Recurring"
            />
          )}
        </p>
        <Money
          amount={t.amount}
          sign={income}
          variant={income ? "income" : "default"}
          className="row-span-2 text-sm font-bold md:col-start-5 md:row-start-1 md:justify-self-end"
        />
        {/* On phones the category and payment method share one line; from 768px up each gets a column. */}
        <p className="min-w-0 text-xs text-muted-foreground md:contents">
          <span className="md:col-start-2 md:row-start-2">{category}</span>
          {t.payment_method && (
            <span className="before:content-[',_'] md:col-start-3 md:row-span-2 md:row-start-1 md:self-center md:text-sm md:before:content-none">
              {t.payment_method.name}
            </span>
          )}
        </p>
        {t.tags.length > 0 && (
          <p className="col-start-2 flex flex-wrap gap-x-2 text-xs text-brand-text md:col-start-4 md:row-span-2 md:row-start-1 md:self-center">
            {t.tags.slice(0, MAX_TAGS).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
            {extra > 0 && <span>+{extra}</span>}
          </p>
        )}
      </button>
    </li>
  );
}
