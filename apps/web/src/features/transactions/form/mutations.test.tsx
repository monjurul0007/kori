import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { server } from "@/test/setup";

import { makeTx } from "../fixtures";
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "./mutations";
import type { TransactionBody } from "./mutations";

const KEY = ["transactions", { month: "2026-09", categoryIds: [], q: "" }];
const body = { type: "expense", amount: "10", occurred_on: "2026-09-10" } as TransactionBody;

function setup(items = [makeTx("a"), makeTx("b")]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, {
    pageParams: [undefined],
    pages: [{ items, next_cursor: null, totals: { expense: "0", income: "0", count: 2 } }],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const ids = () =>
    (client.getQueryData(KEY) as { pages: { items: { id: string }[] }[] }).pages[0]!.items.map(
      (t) => t.id,
    );
  return { client, wrapper, ids };
}

const fail = () =>
  HttpResponse.json(
    { type: "about:blank", title: "Boom", status: 500, detail: "Boom" },
    { status: 500, headers: { "content-type": "application/problem+json" } },
  );

describe("transaction mutations", () => {
  it("create prepends the preview optimistically and refetches", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post("*/api/v1/transactions", async () => {
        await gate;
        return HttpResponse.json(makeTx("real"), { status: 201 });
      }),
      http.get("*/api/v1/transactions", () =>
        HttpResponse.json({
          items: [makeTx("real")],
          next_cursor: null,
          totals: { expense: "0", income: "0", count: 1 },
        }),
      ),
    );
    const { wrapper, ids } = setup();
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });
    act(() => result.current.mutate({ body, preview: makeTx("temp") }));
    await waitFor(() => expect(ids()).toEqual(["temp", "a", "b"]));
    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("create rolls back when the server rejects it", async () => {
    server.use(
      http.post("*/api/v1/transactions", fail),
      http.get("*/api/v1/transactions", () => fail()),
    );
    const { wrapper, ids } = setup();
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ body, preview: makeTx("temp") }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids()).toEqual(["a", "b"]);
  });

  it("update replaces only the matching row optimistically", async () => {
    server.use(
      http.put("*/api/v1/transactions/:id", () => HttpResponse.json(makeTx("a"))),
      http.get("*/api/v1/transactions", () =>
        HttpResponse.json({
          items: [],
          next_cursor: null,
          totals: { expense: "0", income: "0", count: 0 },
        }),
      ),
    );
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useUpdateTransaction("a"), { wrapper });
    act(() => result.current.mutate({ body, preview: makeTx("a", { amount: "999" }) }));
    await waitFor(() => {
      const data = client.getQueryData(KEY) as
        { pages: { items: { id: string; amount: string }[] }[] } | undefined;
      expect(data?.pages[0]?.items.map((t) => t.amount)).toEqual(["999", "250"]);
    });
  });

  it("delete removes the row and restores it on failure", async () => {
    server.use(
      http.delete("*/api/v1/transactions/:id", fail),
      http.get("*/api/v1/transactions", () => fail()),
    );
    const { wrapper, ids } = setup();
    const { result } = renderHook(() => useDeleteTransaction("a"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ body, preview: makeTx("a") }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids()).toEqual(["a", "b"]);
  });

  it("delete drops the row when the server accepts", async () => {
    server.use(
      http.delete("*/api/v1/transactions/:id", () => new HttpResponse(null, { status: 204 })),
      http.get("*/api/v1/transactions", () =>
        HttpResponse.json({
          items: [makeTx("b")],
          next_cursor: null,
          totals: { expense: "0", income: "0", count: 1 },
        }),
      ),
    );
    const { wrapper, ids } = setup();
    const { result } = renderHook(() => useDeleteTransaction("a"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ body, preview: makeTx("a") });
    });
    await waitFor(() => expect(ids()).toEqual(["b"]));
  });
});
