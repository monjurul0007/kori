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

  it("exports with the current filters", async () => {
    mockApi(() => page([tx("a")]));
    renderApp("/transactions?month=2026-09&type=expense&tag=eid");
    const link = await screen.findByRole("link", { name: /export csv/i });
    expect(link).toHaveAttribute("download");
    const href = new URL(link.getAttribute("href") ?? "", "http://localhost");
    expect(href.pathname).toBe("/api/v1/transactions/export.csv");
    expect(href.searchParams.get("month")).toBe("2026-09");
    expect(href.searchParams.get("type")).toBe("expense");
    expect(href.searchParams.get("tag")).toBe("eid");
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
    expect(income).toHaveClass("text-income");
    expect(screen.getAllByText("৳250").at(-1)).not.toHaveClass("text-income");
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
    expect(await screen.findByRole("dialog")).toHaveTextContent("New expense");
  });

  describe("Add one from the viewed month", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("defaults to the last day of a past month", async () => {
      mockApi(() => page([]));
      renderApp("/transactions?month=2026-10");
      await userEvent.click(await screen.findByRole("button", { name: "Add one" }));
      await userEvent.click(await screen.findByRole("button", { name: "Sat, 31 Oct" }));
      expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-31");
    });

    it("defaults to today in the current month", async () => {
      mockApi(() => page([]));
      renderApp("/transactions?month=2026-11");
      await userEvent.click(await screen.findByRole("button", { name: "Add one" }));
      await userEvent.click(await screen.findByRole("button", { name: "Today" }));
      expect(await screen.findByLabelText("Date")).toHaveValue("2026-11-24");
    });

    it("uses the viewed month for the shell Add button too", async () => {
      mockApi(() => page([]));
      renderApp("/transactions?month=2026-10");
      await screen.findByRole("button", { name: "Add one" });
      await userEvent.click(screen.getAllByRole("button", { name: /^Add/ }).at(-1)!);
      await userEvent.click(await screen.findByRole("button", { name: "Sat, 31 Oct" }));
      expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-31");
    });

    it("doesn't offer Add one for a future month", async () => {
      mockApi(() => page([]));
      renderApp("/transactions?month=2026-12");
      expect(await screen.findByText("This month hasn't started yet.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add one" })).not.toBeInTheDocument();
    });
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

describe("transactions search states", () => {
  it("shows a 'no match' state with Clear search instead of the month empty state", async () => {
    mockApi((url) => (url.searchParams.get("q") ? page([]) : page([tx("a")])));
    renderApp("/transactions?month=2026-09&q=zzzz");
    expect(await screen.findByText('No transactions match "zzzz"')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add one" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search transactions" })).toHaveValue("");
  });

  it("shows a 'no match' state with Clear filters when a filter matches nothing", async () => {
    mockApi((url) => (url.searchParams.get("tag") ? page([]) : page([tx("a")])));
    renderApp("/transactions?month=2026-09&tag=eid");
    expect(await screen.findByText("No transactions match these filters")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add one" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
  });

  it("keeps the month empty state when nothing is filtered", async () => {
    mockApi(() => page([]));
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByText(/No transactions in September/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one" })).toBeInTheDocument();
    expect(screen.queryByText(/No transactions match/)).not.toBeInTheDocument();
  });

  it("hints at the 2-character minimum for a 1-character search", async () => {
    mockApi(() => page([tx("a")]));
    renderApp("/transactions?month=2026-09&q=Q");
    expect(await screen.findByText("Type at least 2 characters to search")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "u");
    await waitFor(() =>
      expect(screen.queryByText("Type at least 2 characters to search")).not.toBeInTheDocument(),
    );
  });

  it("keeps the previous rows, dimmed, while a new query loads", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
      http.get("*/api/v1/categories", () => HttpResponse.json([food, bills])),
      http.get("*/api/v1/payment-methods", () => HttpResponse.json([])),
      http.get("*/api/v1/transactions", async ({ request }) => {
        if (new URL(request.url).searchParams.get("q")) await gate;
        return HttpResponse.json(page([tx("a")]));
      }),
    );
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "shop");
    await waitFor(() => expect(document.querySelector("[aria-busy='true']")).toBeInTheDocument());
    expect(screen.getByText("Shop a")).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    release();
    await waitFor(() =>
      expect(document.querySelector("[aria-busy='true']")).not.toBeInTheDocument(),
    );
  });
  it("doesn't describe the new query with the previous empty result while loading", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
      http.get("*/api/v1/categories", () => HttpResponse.json([food, bills])),
      http.get("*/api/v1/payment-methods", () => HttpResponse.json([])),
      http.get("*/api/v1/transactions", async ({ request }) => {
        if (new URL(request.url).searchParams.get("q")) {
          await gate;
          return HttpResponse.json(page([tx("a")]));
        }
        return HttpResponse.json(page([]));
      }),
    );
    renderApp("/transactions?month=2026-09");
    expect(await screen.findByRole("button", { name: "Add one" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "ab");
    await waitFor(() => expect(document.querySelector("[aria-busy='true']")).toBeInTheDocument());
    expect(screen.queryByText(/No transactions match/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add one" })).not.toBeInTheDocument();
    release();
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
  });
});
