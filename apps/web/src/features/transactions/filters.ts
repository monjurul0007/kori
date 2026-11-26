import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { monthOf, todayInDhaka } from "@/lib/dates";

export interface Filters {
  month: string;
  type?: "expense" | "income";
  categoryIds: string[];
  paymentMethodId?: string;
  tag?: string;
  q: string;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The list's filters live in the URL, so back, refresh and sharing all keep them. */
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const month = params.get("month");
    const type = params.get("type");
    return {
      month: month && MONTH.test(month) ? month : monthOf(todayInDhaka()),
      type: type === "expense" || type === "income" ? type : undefined,
      categoryIds: params.getAll("category_id").filter(Boolean),
      paymentMethodId: params.get("payment_method_id") || undefined,
      tag: params.get("tag") || undefined,
      q: params.get("q") ?? "",
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const merged = { ...filters, ...patch };
          const set = (key: string, value?: string) =>
            value ? next.set(key, value) : next.delete(key);
          set("month", merged.month);
          set("type", merged.type);
          next.delete("category_id");
          merged.categoryIds.forEach((id) => next.append("category_id", id));
          set("payment_method_id", merged.paymentMethodId);
          set("tag", merged.tag);
          set("q", merged.q);
          return next;
        },
        { replace: "q" in patch },
      );
    },
    [filters, setParams],
  );

  return { filters, update };
}

/** Same-origin link to the CSV export for the current filters (the session cookie goes along). */
export function exportHref(filters: Filters): string {
  const query = new URLSearchParams({ month: filters.month });
  if (filters.type) query.set("type", filters.type);
  filters.categoryIds.forEach((id) => query.append("category_id", id));
  if (filters.paymentMethodId) query.set("payment_method_id", filters.paymentMethodId);
  if (filters.tag) query.set("tag", filters.tag);
  const q = filters.q.trim();
  if (q.length >= 2) query.set("q", q);
  return `/api/v1/transactions/export.csv?${query}`;
}

interface KindedCategory {
  kind: "expense" | "income";
}

/** Splits categories into expense and income, keeping their order, for grouped pickers. */
export function groupCategoriesByKind<T extends KindedCategory>(categories: T[]) {
  return [
    {
      kind: "expense" as const,
      label: "Expense",
      categories: categories.filter((c) => c.kind === "expense"),
    },
    {
      kind: "income" as const,
      label: "Income",
      categories: categories.filter((c) => c.kind === "income"),
    },
  ].filter((group) => group.categories.length > 0);
}

export const NO_FILTERS: Pick<Filters, "q" | "type" | "categoryIds" | "paymentMethodId" | "tag"> = {
  q: "",
  type: undefined,
  categoryIds: [],
  paymentMethodId: undefined,
  tag: undefined,
};
