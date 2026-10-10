import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty } from "@/api/client";
import type { components } from "@/api/schema";

import type { Transaction } from "../TransactionRow";

export type TransactionBody = components["schemas"]["TransactionIn"];
type Page = components["schemas"]["TransactionPage"];
type Cache = InfiniteData<Page, string | undefined>;

/** `preview` is the row as we expect the server to return it, for the optimistic update. */
interface Vars {
  body: TransactionBody;
  preview: Transaction;
}

function useOptimistic(change: (items: Transaction[], vars: Vars) => Transaction[]) {
  const client = useQueryClient();
  return {
    async onMutate(vars: Vars) {
      await client.cancelQueries({ queryKey: ["transactions"] });
      const snapshot = client.getQueriesData<Cache>({ queryKey: ["transactions"] });
      client.setQueriesData<Cache>(
        { queryKey: ["transactions"] },
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((p) => ({ ...p, items: change(p.items, vars) })),
          },
      );
      return { snapshot };
    },
    onError(_e: unknown, _v: Vars, ctx?: { snapshot: [readonly unknown[], Cache | undefined][] }) {
      ctx?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  };
}

export function useCreateTransaction() {
  const optimistic = useOptimistic((items, { preview }) =>
    // Only the unfiltered current month can show the new row without a refetch.
    items.length && items[0]?.occurred_on.slice(0, 7) === preview.occurred_on.slice(0, 7)
      ? [preview, ...items].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
      : items,
  );
  return useMutation({
    mutationFn: async ({ body }: Vars) => unwrap(await api.POST("/api/v1/transactions", { body })),
    ...optimistic,
  });
}

export function useUpdateTransaction(id: string) {
  const optimistic = useOptimistic((items, { preview }) =>
    items.map((t) => (t.id === id ? preview : t)),
  );
  return useMutation({
    mutationFn: async ({ body }: Vars) =>
      unwrap(
        await api.PUT("/api/v1/transactions/{transaction_id}", {
          params: { path: { transaction_id: id } },
          body,
        }),
      ),
    ...optimistic,
  });
}

export function useDeleteTransaction(id: string) {
  const optimistic = useOptimistic((items) => items.filter((t) => t.id !== id));
  return useMutation({
    mutationFn: async () =>
      unwrapEmpty(
        await api.DELETE("/api/v1/transactions/{transaction_id}", {
          params: { path: { transaction_id: id } },
        }),
      ),
    ...optimistic,
  });
}
