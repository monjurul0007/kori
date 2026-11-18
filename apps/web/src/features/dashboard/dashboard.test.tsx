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

  it("shows spent, limit, remaining and days left", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("৳8,000")).toBeInTheDocument();
    expect(screen.getByText("of ৳20,000")).toBeInTheDocument();
    expect(screen.getByText("৳12,000 left")).toBeInTheDocument();
    expect(screen.getByText("9 days left")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Budget used" })).toHaveAttribute(
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

  it("shows an over-budget summary with the amount over", async () => {
    mockApi({
      status: status({
        overall: overall({ spent: "22000", remaining: "-2000", percent: "110.0", level: "over" }),
      }),
    });
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("৳2,000 over budget")).toBeInTheDocument();
  });

  it("warns amber at 85% and red at 100%, with text and an icon", async () => {
    mockApi({
      status: status({
        categories: [
          catStatus("Food & Dining", "85.0", "warning"),
          catStatus("Rent", "120.0", "over"),
          catStatus("Fun", "20.0", "ok"),
        ],
      }),
    });
    renderApp("/dashboard?month=2026-09");
    const list = await screen.findByRole("list", { name: "Budget warnings" });
    const [amber, red] = within(list).getAllByRole("listitem");
    expect(amber).toHaveTextContent("Food & Dining is at 85% of ৳12,000 with 9 days left");
    expect(amber).toHaveClass("bg-amber-50");
    expect(amber!.querySelector("svg")).not.toBeNull();
    expect(red).toHaveTextContent("Over budget: Rent is at 120% of ৳12,000");
    expect(red).toHaveClass("bg-red-50");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("links to /budgets when there are no budgets", async () => {
    mockApi({ status: status({ overall: null }) });
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByRole("link", { name: "Set budgets" })).toHaveAttribute(
      "href",
      "/budgets",
    );
  });

  it("shows a donut and a list with each category's amount and percent", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    expect(
      await screen.findByRole("img", { name: "Spending by category, total ৳8,000" }),
    ).toBeInTheDocument();
    expect(screen.getByText("৳6,000 · 75.0%")).toBeInTheDocument();
    expect(screen.getByText("৳2,000 · 25.0%")).toBeInTheDocument();
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

  it("shows 5 recent transactions and a See all link for the month", async () => {
    mockApi();
    renderApp("/dashboard?month=2026-09");
    expect(await screen.findByText("Shop a")).toBeInTheDocument();
    expect(screen.queryByText("Shop f")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09",
    );
  });

  it("switching months updates the URL and refetches all three reports", async () => {
    const urls = mockApi();
    const { router } = renderApp("/dashboard?month=2026-09");
    await screen.findByText("৳8,000");
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
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Internal Server Error|Couldn't load/);
    expect(await screen.findByText("৳12,000 left")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("invalidates the reports when a transaction is saved", async () => {
    mockApi();
    const { client } = renderApp("/dashboard?month=2026-09");
    await screen.findByText("৳8,000");
    expect(client.getQueryState(["reports", "spending", "2026-09"])?.isInvalidated).toBe(false);
    const { REPORTS_KEY } = await import("./hooks");
    await client.invalidateQueries({ queryKey: REPORTS_KEY });
    expect(client.getQueryCache().findAll({ queryKey: REPORTS_KEY }).length).toBe(3);
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
