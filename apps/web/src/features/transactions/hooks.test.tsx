import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { server } from "@/test/setup";

import type { Filters } from "./filters";
import { useTransactions } from "./hooks";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const filters = (over: Partial<Filters> = {}): Filters => ({
  month: "2026-09",
  categoryIds: [],
  q: "",
  ...over,
});

function record() {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/v1/transactions", ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({
        items: [],
        next_cursor: null,
        totals: { expense: "0", income: "0", count: 0 },
      });
    }),
  );
  return urls;
}

describe("useTransactions", () => {
  it("sends the month and only the filters that are set", async () => {
    const urls = record();
    const { result } = renderHook(() => useTransactions(filters()), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = urls[0]!.searchParams;
    expect(params.get("month")).toBe("2026-09");
    for (const key of ["type", "category_id", "payment_method_id", "tag", "q", "cursor"]) {
      expect(params.has(key)).toBe(false);
    }
  });

  it("sends every filter, with categories repeated", async () => {
    const urls = record();
    const { result } = renderHook(
      () =>
        useTransactions(
          filters({
            type: "expense",
            categoryIds: ["a", "b"],
            paymentMethodId: "p",
            tag: "eid",
            q: "star",
          }),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = urls[0]!.searchParams;
    expect(params.get("type")).toBe("expense");
    expect(params.getAll("category_id")).toEqual(["a", "b"]);
    expect(params.get("payment_method_id")).toBe("p");
    expect(params.get("tag")).toBe("eid");
    expect(params.get("q")).toBe("star");
  });

  it.each([["s"], [" s "], ["   "]])(
    "does not send a search shorter than 2 characters (%j)",
    async (q) => {
      const urls = record();
      const { result } = renderHook(() => useTransactions(filters({ q })), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(urls[0]!.searchParams.has("q")).toBe(false);
    },
  );

  it("trims the search before sending it", async () => {
    const urls = record();
    const { result } = renderHook(() => useTransactions(filters({ q: "  star  " })), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]!.searchParams.get("q")).toBe("star");
  });

  it("follows next_cursor and stops when it is null", async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get("*/api/v1/transactions", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return HttpResponse.json({
          items: [],
          next_cursor: cursor ? null : "page2",
          totals: { expense: "0", income: "0", count: 0 },
        });
      }),
    );
    const { result } = renderHook(() => useTransactions(filters()), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(cursors).toEqual([null, "page2"]);
  });
});
