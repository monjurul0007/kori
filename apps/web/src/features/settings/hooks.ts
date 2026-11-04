import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

import type { OrderPatch } from "./reorder";

export type Category = components["schemas"]["CategoryOut"];
export type PaymentMethod = components["schemas"]["PaymentMethodOut"];

// These keys sit under the ones the transaction form reads (["categories"], ["payment-methods"]),
// so invalidating the parent key refreshes both.
const CATEGORIES = ["categories", "manage"] as const;
const PAYMENT_METHODS = ["payment-methods", "manage"] as const;

export function useManagedCategories() {
  return useQuery({
    queryKey: CATEGORIES,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/categories", { params: { query: { include_archived: true } } }),
      ),
  });
}

export function useManagedPaymentMethods() {
  return useQuery({
    queryKey: PAYMENT_METHODS,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/payment-methods", { params: { query: { include_archived: true } } }),
      ),
  });
}

function useRefresh(root: "categories" | "payment-methods") {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [root] });
}

/** Optimistically apply new sort orders to a cached list; returns the rollback. */
function useOptimisticOrder<T extends { id: string; sort_order: number }>(key: readonly string[]) {
  const client = useQueryClient();
  return async (patches: OrderPatch[]) => {
    await client.cancelQueries({ queryKey: key });
    const previous = client.getQueryData<T[]>(key);
    const order = new Map(patches.map((p) => [p.id, p.sort_order]));
    client.setQueryData<T[]>(key, (old) =>
      old?.map((item) =>
        order.has(item.id) ? { ...item, sort_order: order.get(item.id)! } : item,
      ),
    );
    return () => client.setQueryData(key, previous);
  };
}

// ---- categories -------------------------------------------------------------------------

export interface CategoryInput {
  name: string;
  icon: string | null;
  color: string | null;
}

export function useSaveCategory() {
  const refresh = useRefresh("categories");
  return useMutation({
    mutationFn: async (
      v: { id?: string; kind: Category["kind"]; sort_order: number } & CategoryInput,
    ) => {
      const { id, kind, sort_order, ...fields } = v;
      return id
        ? unwrap(
            await api.PATCH("/api/v1/categories/{category_id}", {
              params: { path: { category_id: id } },
              body: fields,
            }),
          )
        : unwrap(await api.POST("/api/v1/categories", { body: { ...fields, kind, sort_order } }));
    },
    onSuccess: refresh,
  });
}

export function useArchiveCategory() {
  const refresh = useRefresh("categories");
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) =>
      unwrap(
        await api.POST(
          archive
            ? "/api/v1/categories/{category_id}/archive"
            : "/api/v1/categories/{category_id}/unarchive",
          { params: { path: { category_id: id } } },
        ),
      ),
    onSuccess: refresh,
  });
}

export function useReorderCategories() {
  const refresh = useRefresh("categories");
  const optimistic = useOptimisticOrder<Category>(CATEGORIES);
  return useMutation({
    mutationFn: async (patches: OrderPatch[]) => {
      for (const { id, sort_order } of patches) {
        unwrap(
          await api.PATCH("/api/v1/categories/{category_id}", {
            params: { path: { category_id: id } },
            body: { sort_order },
          }),
        );
      }
    },
    onMutate: optimistic,
    onError: (_e, _v, rollback) => rollback?.(),
    onSettled: refresh,
  });
}

// ---- payment methods --------------------------------------------------------------------

export interface PaymentMethodInput {
  name: string;
  kind: PaymentMethod["kind"];
}

export function useSavePaymentMethod() {
  const refresh = useRefresh("payment-methods");
  return useMutation({
    mutationFn: async (v: { id?: string; sort_order: number } & PaymentMethodInput) => {
      const { id, sort_order, ...fields } = v;
      return id
        ? unwrap(
            await api.PATCH("/api/v1/payment-methods/{payment_method_id}", {
              params: { path: { payment_method_id: id } },
              body: fields,
            }),
          )
        : unwrap(await api.POST("/api/v1/payment-methods", { body: { ...fields, sort_order } }));
    },
    onSuccess: refresh,
  });
}

export function useArchivePaymentMethod() {
  const refresh = useRefresh("payment-methods");
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) =>
      unwrap(
        await api.POST(
          archive
            ? "/api/v1/payment-methods/{payment_method_id}/archive"
            : "/api/v1/payment-methods/{payment_method_id}/unarchive",
          { params: { path: { payment_method_id: id } } },
        ),
      ),
    onSuccess: refresh,
  });
}

export function useReorderPaymentMethods() {
  const refresh = useRefresh("payment-methods");
  const optimistic = useOptimisticOrder<PaymentMethod>(PAYMENT_METHODS);
  return useMutation({
    mutationFn: async (patches: OrderPatch[]) => {
      for (const { id, sort_order } of patches) {
        unwrap(
          await api.PATCH("/api/v1/payment-methods/{payment_method_id}", {
            params: { path: { payment_method_id: id } },
            body: { sort_order },
          }),
        );
      }
    },
    onMutate: optimistic,
    onError: (_e, _v, rollback) => rollback?.(),
    onSettled: refresh,
  });
}
