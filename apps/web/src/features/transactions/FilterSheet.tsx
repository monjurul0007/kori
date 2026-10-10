import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { Filters } from "./filters";
import { useCategories, usePaymentMethods, useTags } from "./hooks";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm";

export function FilterSheet({ filters, onChange }: Props) {
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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Filters">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow this month's list.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
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
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filters.categoryIds.includes(c.id)}
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    filters.categoryIds.includes(c.id) && "bg-primary text-primary-foreground",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
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
      </SheetContent>
    </Sheet>
  );
}
