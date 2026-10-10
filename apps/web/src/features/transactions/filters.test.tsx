import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { useFilters } from "./filters";

const wrap = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

const setup = (path: string) =>
  renderHook(() => ({ ...useFilters(), location: useLocation() }), { wrapper: wrap(path) });

describe("useFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T20:00:00Z")); // already 29 Sep 02:00 in Dhaka
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to the current month in Dhaka with no filters", () => {
    const { result } = setup("/transactions");
    expect(result.current.filters).toEqual({
      month: "2026-09",
      type: undefined,
      categoryIds: [],
      paymentMethodId: undefined,
      tag: undefined,
      q: "",
    });
  });

  it("reads every filter from the URL", () => {
    const { result } = setup(
      "/transactions?month=2026-03&type=income&category_id=a&category_id=b&payment_method_id=p&tag=eid&q=star",
    );
    expect(result.current.filters).toEqual({
      month: "2026-03",
      type: "income",
      categoryIds: ["a", "b"],
      paymentMethodId: "p",
      tag: "eid",
      q: "star",
    });
  });

  it.each(["2026-13", "garbage", "2026-9", ""])("ignores an invalid month %j", (month) => {
    const { result } = setup(`/transactions?month=${month}`);
    expect(result.current.filters.month).toBe("2026-09");
  });

  it("ignores an unknown type", () => {
    const { result } = setup("/transactions?type=transfer");
    expect(result.current.filters.type).toBeUndefined();
  });

  it("writes changes to the URL and drops cleared ones", () => {
    const { result } = setup("/transactions?month=2026-09&type=income&tag=eid");
    act(() => result.current.update({ type: undefined, categoryIds: ["a", "b"] }));
    const params = new URLSearchParams(result.current.location.search);
    expect(params.get("month")).toBe("2026-09");
    expect(params.has("type")).toBe(false);
    expect(params.get("tag")).toBe("eid");
    expect(params.getAll("category_id")).toEqual(["a", "b"]);
  });

  it("removes a single category without touching the others", () => {
    const { result } = setup("/transactions?month=2026-09&category_id=a&category_id=b");
    act(() => result.current.update({ categoryIds: ["b"] }));
    expect(new URLSearchParams(result.current.location.search).getAll("category_id")).toEqual([
      "b",
    ]);
  });
});
