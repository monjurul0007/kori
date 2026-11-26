import { SlidersHorizontal } from "lucide-react";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/ui/form-sheet";
import { cn } from "@/lib/utils";

import { groupCategoriesByKind, type Filters } from "./filters";
import { useCategories, usePaymentMethods, useTags } from "./hooks";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm";

export function FilterSheet({ filters, onChange, onClearAll }: Props) {
  const [open, setOpen] = useState(false);
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const tags = useTags().data ?? [];

  const toggleCategory = (id: string) =>
    onChange({
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((c) => c !== id)
        : [...filters.categoryIds, id],
    });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="Filters"
        description="Narrow this month's list."
        footer={
          <>
            <Button type="button" variant="outline" className="flex-1" onClick={onClearAll}>
              Clear all
            </Button>
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-2">
          <label className="block space-y-1 text-sm font-medium">
            Type
            <select
              className={selectClass}
              value={filters.type ?? ""}
              onChange={(e) => onChange({ type: (e.target.value || undefined) as Filters["type"] })}
            >
              <option value="">All</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </label>
          {groupCategoriesByKind(categories).map((group) => (
            <fieldset key={group.kind} className="space-y-1">
              <legend className="text-sm font-medium">{`${group.label} categories`}</legend>
              <div className="flex flex-wrap gap-2">
                {group.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={filters.categoryIds.includes(c.id)}
                    onClick={() => toggleCategory(c.id)}
                    className={cn(
                      "min-h-9 rounded-full border px-3 py-1 text-sm",
                      filters.categoryIds.includes(c.id) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="block space-y-1 text-sm font-medium">
            Payment method
            <select
              className={selectClass}
              value={filters.paymentMethodId ?? ""}
              onChange={(e) => onChange({ paymentMethodId: e.target.value || undefined })}
            >
              <option value="">Any</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Tag
            <select
              className={selectClass}
              value={filters.tag ?? ""}
              onChange={(e) => onChange({ tag: e.target.value || undefined })}
            >
              <option value="">Any</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </FormSheet>
    </>
  );
}
