import { screen, within } from "@testing-library/react";

import { CategoryBreakdown } from "./CategoryBreakdown";
import { cat, mockGet, renderCard } from "./testHelpers";

const row = (id: string, amount: string, percent: string) => ({
  category: cat(id, `Cat ${id}`),
  amount,
  count: 1,
  percent,
});
const report = (by_category: unknown[], total = "8000") => ({
  from: "2026-09-01",
  to: "2026-09-30",
  type: "expense",
  total,
  count: 3,
  by_category,
});

describe("CategoryBreakdown", () => {
  it("draws one stacked-bar segment per category, sized by its percent", async () => {
    mockGet(
      "/api/v1/reports/spending",
      report([row("a", "6000", "75.0"), row("b", "2000", "25.0")]),
    );
    renderCard(<CategoryBreakdown month="2026-09" />);
    const bar = await screen.findByRole("img", { name: "Spending by category, total ৳8,000" });
    const widths = within(bar)
      .getAllByTestId("stack-segment")
      .map((segment) => segment.style.width);
    expect(widths).toEqual(["75%", "25%"]);
  });

  it("lists each category with its amount and percent", async () => {
    mockGet(
      "/api/v1/reports/spending",
      report([row("a", "6000", "75.0"), row("b", "2000", "25.0")]),
    );
    renderCard(<CategoryBreakdown month="2026-09" />);
    const list = await screen.findByRole("list");
    const [first, second] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent("Cat a৳6,00075.0%");
    expect(second).toHaveTextContent("Cat b৳2,00025.0%");
  });

  it("links each category to that month's transactions filtered by it", async () => {
    mockGet("/api/v1/reports/spending", report([row("a", "6000", "75.0")]));
    renderCard(<CategoryBreakdown month="2026-09" />);
    expect(await screen.findByRole("link", { name: "Cat a" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09&category_id=a",
    );
  });

  it("links to all of the month's expenses from the card heading", async () => {
    mockGet("/api/v1/reports/spending", report([row("a", "6000", "75.0")]));
    renderCard(<CategoryBreakdown month="2026-09" />);
    expect(await screen.findByRole("link", { name: "All categories" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09&type=expense",
    );
  });

  it("rolls categories beyond the top 6 into Other, which has no link", async () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => row(id, "100", "12.5"));
    mockGet("/api/v1/reports/spending", report(rows, "800"));
    renderCard(<CategoryBreakdown month="2026-09" />);
    const other = (await screen.findByText("Other")).closest("li")!;
    expect(other).toHaveTextContent("৳20025.0%");
    expect(within(other).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Cat h")).not.toBeInTheDocument();
  });

  it("says so when there is no spending", async () => {
    mockGet("/api/v1/reports/spending", report([], "0"));
    renderCard(<CategoryBreakdown month="2026-09" />);
    expect(await screen.findByText("No spending this month.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
