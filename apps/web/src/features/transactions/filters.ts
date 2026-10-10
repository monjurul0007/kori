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
