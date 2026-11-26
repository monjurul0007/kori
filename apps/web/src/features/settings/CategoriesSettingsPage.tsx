import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryTile } from "@/components/ui/category-tile";
import { useSpending } from "@/features/dashboard/hooks";
import { monthOf, todayInDhaka } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CATEGORY_COLORS, CATEGORY_ICONS } from "./categoryStyle";
import {
  useArchiveCategory,
  useManagedCategories,
  useReorderCategories,
  useSaveCategory,
  type Category,
} from "./hooks";
import { SETTINGS_PARENT } from "./parent";
import { nextSortOrder } from "./reorder";
import { CATEGORY_NAME_MAX } from "./nameLimits";
import { ReferenceListEditor } from "./ReferenceListEditor";

type Extra = { icon: string | null; color: string | null };

const KINDS = [
  { kind: "expense", label: "Expense" },
  { kind: "income", label: "Income" },
] as const;

export function CategoriesSettingsPage() {
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const categories = useManagedCategories();
  const save = useSaveCategory();
  const archive = useArchiveCategory();
  const reorder = useReorderCategories();
  const spending = useSpending(monthOf(todayInDhaka()));
  const spentById = new Map(
    (spending.data?.by_category ?? []).map((s) => [s.category.id, s.amount]),
  );

  const ofKind = (categories.data ?? []).filter((c) => c.kind === kind);

  return (
    <>
      <PageHeader title="Categories" backTo={SETTINGS_PARENT} />
      <div role="tablist" aria-label="Category type" className="mb-4 flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            role="tab"
            type="button"
            aria-selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm",
              kind === k.kind
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      {categories.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : categories.isError ? (
        <p role="alert">Couldn’t load categories.</p>
      ) : (
        <ReferenceListEditor<Category, Extra>
          noun="category"
          maxNameLength={CATEGORY_NAME_MAX}
          items={ofKind}
          leading={(c) => <CategoryTile icon={c.icon} color={c.color} className="h-10 w-10" />}
          detail={(c) =>
            // No spend text until the report has loaded: a missing entry means "none" only then.
            kind === "expense" && spending.isSuccess ? spendThisMonth(spentById.get(c.id)) : null
          }
          initialExtra={(c) => ({ icon: c?.icon ?? null, color: c?.color ?? null })}
          extraFields={(value, set) => <CategoryExtras value={value} onChange={set} />}
          onSave={({ item, name, extra }) =>
            save.mutateAsync({
              id: item?.id,
              kind,
              sort_order: item?.sort_order ?? nextSortOrder(ofKind),
              name,
              ...extra,
            })
          }
          onMove={(patches) => patches.length && reorder.mutate(patches)}
          onArchive={(item, archived) => archive.mutateAsync({ id: item.id, archive: archived })}
        />
      )}
    </>
  );
}

const spendThisMonth = (amount: string | undefined) =>
  amount ? `${formatTaka(amount)} this month` : "Nothing yet";

function CategoryExtras({ value, onChange }: { value: Extra; onChange: (v: Extra) => void }) {
  return (
    <>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Icon</legend>
        <div className="grid grid-cols-[repeat(auto-fill,2.75rem)] gap-2">
          {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              aria-label={name.replace(/-/g, " ")}
              aria-pressed={value.icon === name}
              onClick={() => onChange({ ...value, icon: value.icon === name ? null : name })}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-md border",
                value.icon === name ? "border-primary bg-muted" : "hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.name}
              aria-pressed={value.color === c.value}
              onClick={() =>
                onChange({ ...value, color: value.color === c.value ? null : c.value })
              }
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-md border",
                value.color === c.value ? "border-primary bg-muted" : "hover:bg-muted",
              )}
            >
              <span
                aria-hidden="true"
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: c.value }}
              />
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
