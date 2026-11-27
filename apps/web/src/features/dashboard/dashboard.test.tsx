import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

import { bills, food, makeTx } from "../transactions/fixtures";
import { groupTop } from "./breakdown";

const user = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};
const cat = (id: string, name: string) => ({ id, name, kind: "expense" as const, archived: false });
const spendRow = (id: string, amount: string, percent: string) => ({
  category: cat(id, `Cat ${id}`),
  amount,
  count: 1,
  percent,
});

const overall = (over = {}) => ({
  limit: "20000",
  limit_source: "set",
  spent: "8000",
  remaining: "12000",
  percent: "40.0",
  level: "ok",
  ...over,
});
const status = (over = {}) => ({
  month: "2026-09",
  days_in_month: 30,
  days_elapsed: 21,
  days_left: 9,
  overall: overall(),
  categories: [],
  unbudgeted: { spent: "0" },
  ...over,
});
const catStatus = (name: string, percent: string, level: string) => ({
  category: cat(name, name),
  limit: "12000",
  spent: "10200",
  remaining: "1800",
  percent,
  level,
});
const trend = {
  months: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((month, i) => ({
    month,
    expense: String((i + 1) * 1000),
    income: "5000",
  })),
};

function mockApi(opts: { status?: unknown; spending?: unknown; trendFail?: boolean } = {}) {
  const urls: Record<string, URL[]> = { spending: [], status: [], trend: [] };
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () => HttpResponse.json([food, bills])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([])),
    http.get("*/api/v1/tags", () => HttpResponse.json([])),
    http.get("*/api/v1/reports/budget-status", ({ request }) => {
      urls.status!.push(new URL(request.url));
      return HttpResponse.json(opts.status ?? status());
    }),
    http.get("*/api/v1/reports/spending", ({ request }) => {
      urls.spending!.push(new URL(request.url));
      return HttpResponse.json(
        opts.spending ?? {
          from: "2026-09-01",
          to: "2026-09-30",
          type: "expense",
          total: "8000",
          count: 3,
          by_category: [spendRow("a", "6000", "75.0"), spendRow("b", "2000", "25.0")],
        },
      );
    }),
    http.get("*/api/v1/reports/trend", ({ request }) => {
      urls.trend!.push(new URL(request.url));
      return opts.trendFail
        ? HttpResponse.json({ title: "Boom", status: 500 }, { status: 500 })
        : HttpResponse.json(trend);
    }),
    http.get("*/api/v1/transactions", () =>
      HttpResponse.json({
        items: ["a", "b", "c", "d", "e", "f"].map((id) => makeTx(id)),
        next_cursor: null,
        totals: { expense: "1500", income: "0", count: 6 },
      }),
    ),
  );
  return urls;
}

describe("dashboard", () => {
  it("redirects / to /dashboard", async () => {
    mockApi();
    const { router } = renderApp("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("lists Dashboard as the first nav item", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    const nav = (await screen.findAllByRole("navigation", { name: "Main" }))[0]!;
    expect(within(nav).getAllByRole("link")[0]).toHaveAccessibleName("Dashboard");
  });

  it("shows what is left to spend, the budget used and days left", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    await screen.findByText("Left to spend in September");
    const hero = screen.getByRole("region", { name: "Left to spend" });
    expect(within(hero).getByText("৳12,000")).toBeInTheDocument();
    expect(within(hero).getByText("৳8,000 of ৳20,000 spent")).toBeInTheDocument();
    expect(within(hero).getByText("9 days left")).toBeInTheDocument();
    expect(within(hero).getByRole("progressbar", { name: "Budget used" })).toHaveAttribute(
      "aria-valuetext",
      "40% used",
    );
    expect(screen.queryByText("Sum of category budgets")).not.toBeInTheDocument();
  });

  it("labels a limit that is the sum of category budgets", async () => {
    mockApi({ status: status({ overall: overall({ limit_source: "sum_of_categories" }) }) });
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("Sum of category budgets")).toBeInTheDocument();
  });

  it("shows the amount over when the budget is exceeded", async () => {
    mockApi({
      status: status({
        overall: overall({ spent: "22000", remaining: "-2000", percent: "110.0", level: "over" }),
      }),
    });
    renderApp("/dashboard?month=2026-09");
    await screen.findByText("Over budget in September");
    const hero = screen.getByRole("region", { name: "Left to spend" });
    expect(within(hero).getByText("৳2,000")).toBeInTheDocument();
    expect(within(hero).getByText("over")).toBeInTheDocument();
    expect(within(hero).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows what was spent, and a link to set a budget, when there is no budget", async () => {
    mockApi({ status: status({ overall: null }) });
    renderApp("/dashboard?month=2026-09");
    const hero = await screen.findByRole("region", { name: "Spent in September" });
    expect(await within(hero).findByText("৳8,000")).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: "Set a monthly budget" })).toHaveAttribute(
      "href",
      "/budgets",
    );
  });

  it("shows an error with a retry when the spending report fails and there is no budget", async () => {
    mockApi({ status: status({ overall: null }) });
    let fail = true;
    server.use(
      http.get("*/api/v1/reports/spending", () =>
        fail
          ? HttpResponse.json({ title: "Boom", status: 500 }, { status: 500 })
          : HttpResponse.json({
              from: "2026-09-01",
              to: "2026-09-30",
              type: "expense",
              total: "8000",
              count: 1,
              by_category: [],
            }),
      ),
    );
    renderApp("/dashboard?month=2026-09");
    const hero = await screen.findByRole("alert", { name: "Left to spend" });
    expect(hero).toHaveTextContent("Couldn't load your budget.");
    fail = false;
    await userEvent.click(within(hero).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Spent in September" })).toBeInTheDocument();
  });

  it("always shows spent, income and net, with last month's spending", async () => {
    mockApi({ status: status({ overall: null }) });
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("August total: ৳5,000")).toBeInTheDocument();
    const totals = screen.getByText("Net").closest("dl")!;
    expect(within(totals).getByText("৳6,000")).toBeInTheDocument();
    expect(within(totals).getByText("+৳5,000")).toBeInTheDocument();
    expect(within(totals).getByText("-৳1,000")).toBeInTheDocument();
    expect(within(totals).getByText("Spent more than earned")).toBeInTheDocument();
  });

  it("lists over, near-limit and fully used budgets, each linking to its transactions", async () => {
    mockApi({
      status: status({
        categories: [
          catStatus("Food & Dining", "85.0", "warning"),
          {
            ...catStatus("Rent", "120.0", "over"),
            spent: "14400",
            limit: "12000",
            remaining: "-2400",
          },
          { ...catStatus("Bills", "100.0", "over"), spent: "12000", remaining: "0" },
          catStatus("Fun", "20.0", "ok"),
        ],
      }),
    });
    renderApp("/dashboard?month=2026-09");
    const section = await screen.findByRole("region", { name: "Needs attention" });
    const links = within(section).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Rent is ৳2,400 over its ৳12,000 budget.",
      "Food & Dining has ৳1,800 left for the last 9 days.",
      "Bills is fully used. Its ৳12,000 budget is spent.",
    ]);
    expect(links[0]).toHaveAttribute("href", "/transactions?month=2026-09&category_id=Rent");
  });

  it("hides Needs attention when every budget is fine", async () => {
    mockApi({ status: status({ categories: [catStatus("Fun", "20.0", "ok")] }) });
    renderApp("/dashboard?month=2026-09");
    await screen.findByText("Left to spend in September");
    expect(screen.queryByRole("region", { name: "Needs attention" })).not.toBeInTheDocument();
  });

  it("shows a stacked bar and a list with each category's amount and percent", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    expect(
      await screen.findByRole("img", { name: "Spending by category, total ৳8,000" }),
    ).toBeInTheDocument();
    const rows = within(
      screen.getByRole("heading", { name: "Where it went" }).closest("div")!.parentElement!,
    ).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("৳6,00075.0%");
    expect(rows[1]).toHaveTextContent("৳2,00025.0%");
  });

  it("renders 6 trend bars and an accessible table", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    const bars = await screen.findAllByTestId("trend-bar");
    expect(bars).toHaveLength(6);
    const table = screen.getByRole("table", { name: "Expense and income by month" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(within(table).getByText("৳6,000")).toBeInTheDocument();
  });

  it("shows the recent transactions and a link to the month's list", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
    expect(screen.getByText("Shop f")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all transactions" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09",
    );
  });

  it("switching months updates the URL and refetches all three reports", async () => {
    const urls = mockApi();
    const { router } = renderApp("/dashboard?month=2026-09");
    await screen.findByText("Left to spend in September");
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(router.state.location.search).toBe("?month=2026-08"));
    await waitFor(() => {
      expect(urls.status!.at(-1)!.searchParams.get("month")).toBe("2026-08");
      expect(urls.spending!.at(-1)!.searchParams.get("month")).toBe("2026-08");
      expect(urls.trend!.at(-1)!.searchParams.get("end")).toBe("2026-08");
    });
  });

  it("keeps working when one card fails, and retries that card", async () => {
    mockApi({ trendFail: true });
    renderApp("/dashboard?month=2026-09");
    // Totals and the trend chart both read the trend report, so both show the failure.
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    const alert = screen.getAllByRole("alert")[0]!;
    expect(alert).toHaveTextContent(/Internal Server Error|Couldn't load/);
    expect(await screen.findByText("Left to spend in September")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("invalidates the reports when a transaction is saved", async () => {
    mockApi();
    const { client } = renderApp("/dashboard?month=2026-09");
    await screen.findByText("Left to spend in September");
    expect(client.getQueryState(["reports", "spending", "2026-09"])?.isInvalidated).toBe(false);
    const { REPORTS_KEY } = await import("./hooks");
    await client.invalidateQueries({ queryKey: REPORTS_KEY });
    const forViewedMonth = client
      .getQueryCache()
      .findAll({ queryKey: REPORTS_KEY })
      .filter((query) => query.queryKey[2] === "2026-09");
    expect(forViewedMonth).toHaveLength(3);
  });
});

describe("groupTop", () => {
  it("keeps the top 6 and rolls the rest into Other", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) =>
      spendRow(id, "100.50", "12.5"),
    );
    const slices = groupTop(rows);
    expect(slices).toHaveLength(7);
    expect(slices[6]).toMatchObject({ name: "Other", amount: "201.00", percent: "25.0", count: 2 });
  });

  it("adds no Other for 6 or fewer", () => {
    expect(groupTop([spendRow("a", "1", "100.0")])).toHaveLength(1);
  });
});
