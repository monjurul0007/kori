import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: async () => unwrap(await api.GET("/api/v1/budgets", { params: { query: { month } } })),
  });
}

/** Active expense categories, for the "No budget" group. Sits under ["categories"] for invalidation. */
export function useExpenseCategories() {
  return useQuery({
    queryKey: ["categories", "expense"],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/categories", { params: { query: { kind: "expense" } } })),
  });
}

export interface BudgetChange {
  month: string;
  /** null is the overall limit. */
  categoryId: string | null;
  /** null removes the budget. */
  amount: string | null;
}

/** A budget applies from the month onward, so budgets, budget status and the dashboard all refresh. */
export function useSetBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, categoryId, amount }: BudgetChange) =>
      unwrap(
        await api.PUT("/api/v1/budgets", {
          body: { month, category_id: categoryId, amount },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["budgets"] }),
        client.invalidateQueries({ queryKey: ["reports"] }),
      ]),
  });
}
