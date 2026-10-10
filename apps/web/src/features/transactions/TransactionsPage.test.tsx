import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

import { bills, food, makeTx } from "./fixtures";
import type { Transaction } from "./TransactionRow";

const user = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};
const tx = (id: string, over: Partial<Transaction> = {}) => makeTx(id, over);

const page = (items: unknown[], next: string | null = null) => ({
  items,
  next_cursor: next,
  totals: { expense: "1250.50", income: "2000", count: items.length },
});

/** Records the query string of every list request. */
function mockApi(respond: (url: URL) => Record<string, unknown>) {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () => HttpResponse.json([food, bills])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([{ id: "pm1", name: "bKash" }])),
    http.get("*/api/v1/tags", () => HttpResponse.json([{ id: "t1", name: "eid", usage_count: 2 }])),
    http.get("*/api/v1/transactions", ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      return HttpResponse.json(respond(url));
    }),
  );
  return urls;
}

describe("transactions list", () => {
  it("groups by day and shows API totals", async () => {
    mockApi(() => page([tx("a"), tx("b", { occurred_on: "2026-09-09", amount: "100" })]));
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByRole("region", { name: "Thu, 10 Sep" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wed, 9 Sep" })).toBeInTheDocument();
    expect(screen.getByText("৳1,250.50")).toBeInTheDocument();
    expect(screen.getByText("৳749.50")).toBeInTheDocument(); // net, exact
  });

  it("labels splits and styles income", async () => {
    mockApi(() =>
      page([
        tx("s", {
          is_split: true,
          lines: [
            { category: food, amount: "100", category_source: "user" },
            { category: bills, amount: "100", category_source: "user" },
            { category: bills, amount: "50", category_source: "user" },
          ],
        }),
        tx("i", { type: "income", amount: "5000", merchant: "Salary" }),
      ]),
    );
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByText("Split · 3 categories")).toBeInTheDocument();
    const income = screen.getByText("+৳5,000");
    expect(income).toHaveClass("text-emerald-600");
    expect(screen.getAllByText("৳250").at(-1)).not.toHaveClass("text-emerald-600");
  });

  it("switches months through the URL and refetches", async () => {
    const urls = mockApi(() => page([tx("a")]));
    const { router } = renderApp("/transactions?month=2026-09");
    await screen.findByText("Shop a");
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(router.state.location.search).toContain("month=2026-08"));
    expect(await screen.findByText("August 2026")).toBeInTheDocument();
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("month")).toBe("2026-08"));
  });

  it("applies filters as removable chips", async () => {
    const urls = mockApi(() => page([tx("a")]));
    const { router } = renderApp("/transactions?month=2026-09");
    await screen.findByText("Shop a");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Type"), "income");
    await userEvent.click(within(dialog).getByRole("button", { name: "Bills" }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("type")).toBe("income"));
    expect(urls.at(-1)?.searchParams.getAll("category_id")).toEqual(["c-bills"]);
    expect(router.state.location.search).toContain("category_id=c-bills");

    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter Bills" }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.getAll("category_id")).toEqual([]));
    expect(screen.queryByText("Bills")).not.toBeInTheDocument();
  });

  it("debounces the search", async () => {
    const urls = mockApi(() => page([tx("a")]));
    renderApp("/transactions?month=2026-09");
    await screen.findByText("Shop a");
    const before = urls.length;
    await userEvent.type(screen.getByLabelText("Search transactions"), "star");
    expect(urls).toHaveLength(before); // nothing sent while typing
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("q")).toBe("star"));
    expect(urls.length).toBe(before + 1);
  });

  it("shows the empty state and opens the add sheet", async () => {
    mockApi(() => page([]));
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByText(/No transactions in September/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add one" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Add transaction");
  });

  it("pages in more rows without duplicates", async () => {
    let observe: (() => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          observe = () => cb([{ isIntersecting: true }]);
        }
        observe() {}
        disconnect() {}
      },
    );
    const urls = mockApi((url) =>
      url.searchParams.get("cursor") ? page([tx("b")]) : page([tx("a")], "next"),
    );
    renderApp("/transactions?month=2026-09");
    await screen.findByText("Shop a");
    observe?.();
    await screen.findByText("Shop b");
    expect(screen.getAllByText(/^Shop /)).toHaveLength(2);
    expect(urls.at(-1)?.searchParams.get("cursor")).toBe("next");
    vi.unstubAllGlobals();
  });

  it("offers a retry when loading fails", async () => {
    let fail = true;
    mockApi(() => {
      if (fail) throw new Error("x");
      return page([tx("a")]);
    });
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
  });
});
