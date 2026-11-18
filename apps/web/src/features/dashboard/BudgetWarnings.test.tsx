import { screen, waitFor } from "@testing-library/react";

import { BudgetWarnings } from "./BudgetWarnings";
import { cat, mockGet, renderCard } from "./testHelpers";

const line = (name: string, percent: string, level: string) => ({
  category: cat(name, name),
  limit: "12000",
  spent: "1",
  remaining: "1",
  percent,
  level,
});
const status = (categories: unknown[], days_left = 9) => ({
  month: "2026-09",
  days_in_month: 30,
  days_elapsed: 30 - days_left,
  days_left,
  overall: null,
  categories,
  unbudgeted: { spent: "0" },
});

describe("BudgetWarnings", () => {
  it("renders a line per warning or over category, with text and an icon", async () => {
    mockGet(
      "/api/v1/reports/budget-status",
      status([
        line("Food", "85.0", "warning"),
        line("Rent", "100.0", "over"),
        line("Fun", "5.0", "ok"),
      ]),
    );
    renderCard(<BudgetWarnings month="2026-09" />);
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Warning: Food is at 85% of ৳12,000 with 9 days left");
    expect(items[0]).toHaveClass("bg-amber-50");
    expect(items[1]).toHaveTextContent("Over budget: Rent is at 100% of ৳12,000");
    expect(items[1]).toHaveClass("bg-red-50");
    items.forEach((li) => expect(li.querySelector("svg")).not.toBeNull());
  });

  it("uses the singular for one day left", async () => {
    mockGet("/api/v1/reports/budget-status", status([line("Food", "90.5", "warning")], 1));
    renderCard(<BudgetWarnings month="2026-09" />);
    expect(await screen.findByText(/90.5% of ৳12,000 with 1 day left/)).toBeInTheDocument();
  });

  it("renders nothing when every category is ok", async () => {
    mockGet("/api/v1/reports/budget-status", status([line("Fun", "5.0", "ok")]));
    const { container } = renderCard(<BudgetWarnings month="2026-09" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing when the report fails", async () => {
    mockGet("/api/v1/reports/budget-status", { title: "x", status: 500 }, 500);
    const { container } = renderCard(<BudgetWarnings month="2026-09" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
