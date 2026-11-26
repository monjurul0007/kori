import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { groupCategoriesByKind, type Filters } from "./filters";
import { useCategories, usePaymentMethods, useTags } from "./hooks";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

const TYPE_CHIPS: { label: string; type: Filters["type"] }[] = [
  { label: "All", type: undefined },
  { label: "Expenses", type: "expense" },
  { label: "Income", type: "income" },
];

const MANY_CATEGORIES = "many";

/** All / Expenses / Income chips, the phone's quick type filter. */
export function TypeChips({ filters, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {TYPE_CHIPS.map(({ label, type }) => (
        <button
          key={label}
          type="button"
          aria-pressed={filters.type === type}
          onClick={() => onChange({ type })}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium",
            filters.type === type
              ? "border-transparent bg-brand-soft text-brand-text"
              : "bg-card text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Dropdown({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 appearance-none rounded-xl border bg-card py-0 pl-3.5 pr-9 text-sm"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

/** The desktop toolbar's inline dropdowns, so filtering never needs a full-width sheet. */
export function InlineFilters({ filters, onChange }: Props) {
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const tags = useTags().data ?? [];
  const selectedCount = filters.categoryIds.length;
  const categoryValue = selectedCount > 1 ? MANY_CATEGORIES : (filters.categoryIds[0] ?? "");

  return (
    <div className="flex gap-2">
      <Dropdown
        label="Type"
        value={filters.type ?? ""}
        onChange={(value) => onChange({ type: TYPE_CHIPS.find((c) => c.type === value)?.type })}
      >
        <option value="">All types</option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
      </Dropdown>
      <Dropdown
        label="Category"
        value={categoryValue}
        onChange={(value) =>
          value !== MANY_CATEGORIES && onChange({ categoryIds: value ? [value] : [] })
        }
      >
        <option value="">Category</option>
        {selectedCount > 1 && <option value={MANY_CATEGORIES}>{selectedCount} categories</option>}
        {groupCategoriesByKind(categories).map((group) => (
          <optgroup key={group.kind} label={group.label}>
            {group.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Dropdown>
      <Dropdown
        label="Paid with"
        value={filters.paymentMethodId ?? ""}
        onChange={(value) => onChange({ paymentMethodId: value || undefined })}
      >
        <option value="">Paid with</option>
        {methods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Dropdown>
      <Dropdown
        label="Tag"
        value={filters.tag ?? ""}
        onChange={(value) => onChange({ tag: value || undefined })}
      >
        <option value="">Tag</option>
        {tags.map((t) => (
          <option key={t.id} value={t.name}>
            {t.name}
          </option>
        ))}
      </Dropdown>
    </div>
  );
}
