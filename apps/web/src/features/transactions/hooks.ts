import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";

import type { Filters } from "./filters";

/** The API rejects searches shorter than 2 characters, so those are not sent. */
const MIN_SEARCH = 2;

export function useTransactions(filters: Filters) {
  const q = filters.q.trim();
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/transactions", {
          params: {
            query: {
              month: filters.month,
              type: filters.type,
              category_id: filters.categoryIds.length ? filters.categoryIds : undefined,
              payment_method_id: filters.paymentMethodId,
              tag: filters.tag,
              q: q.length >= MIN_SEARCH ? q : undefined,
              cursor: pageParam,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => unwrap(await api.GET("/api/v1/categories")),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => unwrap(await api.GET("/api/v1/payment-methods")),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => unwrap(await api.GET("/api/v1/tags")),
    staleTime: 5 * 60 * 1000,
  });
}
