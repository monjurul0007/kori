import { screen } from "@testing-library/react";

import { BudgetSummaryCard, shortPercent } from "./BudgetSummaryCard";
import { mockGet, renderCard } from "./testHelpers";

const overall = (over = {}) => ({
  limit: "20000",
  limit_source: "set",
  spent: "8000",
  remaining: "12000",
  percent: "40.0",
  level: "ok",
  ...over,
});
const status = (o: unknown, days_left = 9) => ({
  month: "2026-09",
  days_in_month: 30,
  days_elapsed: 30 - days_left,
  days_left,
  overall: o,
  categories: [],
  unbudgeted: { spent: "0" },
});

describe("BudgetSummaryCard", () => {
  it("shows spent, limit, remaining and days left", async () => {
    mockGet("/api/v1/reports/budget-status", status(overall()));
    renderCard(<BudgetSummaryCard month="2026-09" />);
    expect(await screen.findByText("৳8,000")).toBeInTheDocument();
    expect(screen.getByText("of ৳20,000")).toBeInTheDocument();
    expect(screen.getByText("৳12,000 left")).toBeInTheDocument();
    expect(screen.getByText("9 days left")).toBeInTheDocument();
  });

  it("uses the singular for one day left", async () => {
    mockGet("/api/v1/reports/budget-status", status(overall(), 1));
    renderCard(<BudgetSummaryCard month="2026-09" />);
    expect(await screen.findByText("1 day left")).toBeInTheDocument();
  });

  it.each([
    ["ok", "bg-primary"],
    ["warning", "bg-amber-500"],
    ["over", "bg-red-600"],
  ])("colours the bar for level %s", async (level, cls) => {
    mockGet("/api/v1/reports/budget-status", status(overall({ level })));
    renderCard(<BudgetSummaryCard month="2026-09" />);
    const bar = await screen.findByRole("progressbar", { name: "Budget used" });
    expect(bar.firstElementChild).toHaveClass(cls);
  });

  it("caps the bar at 100% when over budget and shows the overspend", async () => {
    mockGet(
      "/api/v1/reports/budget-status",
      status(overall({ spent: "22000", remaining: "-2000", percent: "110.0", level: "over" })),
    );
    renderCard(<BudgetSummaryCard month="2026-09" />);
    const bar = await screen.findByRole("progressbar", { name: "Budget used" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "110% used");
    expect(screen.getByText("৳2,000 over budget")).toBeInTheDocument();
  });

  it("labels a summed limit", async () => {
    mockGet(
      "/api/v1/reports/budget-status",
      status(overall({ limit_source: "sum_of_categories" })),
    );
    renderCard(<BudgetSummaryCard month="2026-09" />);
    expect(await screen.findByText("Sum of category budgets")).toBeInTheDocument();
  });

  it("offers to set budgets when there are none", async () => {
    mockGet("/api/v1/reports/budget-status", status(null));
    renderCard(<BudgetSummaryCard month="2026-09" />);
    expect(await screen.findByRole("link", { name: "Set budgets" })).toHaveAttribute(
      "href",
      "/budgets",
    );
  });

  it("trims a trailing .0 from percentages", () => {
    expect(shortPercent("85.0")).toBe("85");
    expect(shortPercent("34.5")).toBe("34.5");
    expect(shortPercent("100.0")).toBe("100");
  });
});
