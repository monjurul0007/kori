import { useQueryClient, type InfiniteData } from "@tanstack/react-query";

import type { components } from "@/api/schema";

import { rankCategories } from "./rankCategories";

type Page = components["schemas"]["TransactionPage"];

/** Categories of one kind, most-used first, counted over the transactions already cached. */
export function useRankedCategories<C extends { id: string; sort_order: number }>(
  categories: C[],
): C[] {
  const client = useQueryClient();
  const cached = client
    .getQueriesData<InfiniteData<Page>>({ queryKey: ["transactions"] })
    .flatMap(([, data]) => data?.pages.flatMap((page) => page.items) ?? []);
  return rankCategories(categories, cached);
}
