import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { server } from "@/test/setup";

import { useBudgets, useExpenseCategories, useSetBudget } from "./hooks";

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("budget hooks", () => {
  it("useBudgets sends the month", async () => {
    let month: string | null = null;
    server.use(
      http.get("*/api/v1/budgets", ({ request }) => {
        month = new URL(request.url).searchParams.get("month");
        return HttpResponse.json({ month: "2026-12", overall: null, categories: [] });
      }),
    );
    const { result } = renderHook(() => useBudgets("2026-12"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(month).toBe("2026-12");
  });

  it("useExpenseCategories asks for expense categories only", async () => {
    let kind: string | null = null;
    server.use(
      http.get("*/api/v1/categories", ({ request }) => {
        kind = new URL(request.url).searchParams.get("kind");
        return HttpResponse.json([]);
      }),
    );
    const { result } = renderHook(() => useExpenseCategories(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(kind).toBe("expense");
  });

  it("useSetBudget maps the change to the PUT body and invalidates budgets and reports", async () => {
    let body: unknown;
    server.use(
      http.put("*/api/v1/budgets", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ month: "2026-12", overall: null, categories: [] });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidated: unknown[] = [];
    const spy = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((filters: { queryKey?: unknown }) => {
      invalidated.push(filters?.queryKey);
      return spy(filters as never);
    }) as typeof client.invalidateQueries;

    const { result } = renderHook(() => useSetBudget(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ month: "2026-12", categoryId: null, amount: "9000.50" });
    expect(body).toEqual({ month: "2026-12", category_id: null, amount: "9000.50" });
    expect(invalidated).toEqual([["budgets"], ["reports"]]);
  });
});
