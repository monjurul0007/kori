import { screen, within } from "@testing-library/react";

import { TrendChart } from "./TrendChart";
import { mockGet, renderCard } from "./testHelpers";

const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const trend = (expenses: string[]) => ({
  months: months.map((month, i) => ({ month, expense: expenses[i]!, income: "5000" })),
});

describe("TrendChart", () => {
  it("renders a bar group per month and an accessible table with the same numbers", async () => {
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "3000", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    expect(await screen.findAllByTestId("trend-bar")).toHaveLength(6);
    const table = screen.getByRole("table", { name: "Expense and income by month" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows[6]).toHaveTextContent("September 2026৳6,000৳5,000");
  });

  it("hides the data table in an sr-only wrapper so it cannot widen the page", async () => {
    mockGet("/api/v1/reports/trend", trend(["1", "2", "3", "4", "5", "6"]));
    renderCard(<TrendChart month="2026-09" />);
    const table = await screen.findByRole("table", { name: "Expense and income by month" });
    expect(table).not.toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only");
  });

  it("highlights only the selected month", async () => {
    mockGet("/api/v1/reports/trend", trend(["1", "2", "3", "4", "5", "6"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const solid = groups.filter((g) => g.querySelector("rect")?.classList.contains("fill-primary"));
    expect(solid.map((g) => g.dataset.month)).toEqual(["2026-09"]);
  });

  it("scales bar heights to the largest value", async () => {
    mockGet("/api/v1/reports/trend", trend(["0", "0", "0", "0", "2500", "5000"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const height = (i: number) => Number(groups[i]!.querySelector("rect")!.getAttribute("height"));
    expect(height(0)).toBe(0);
    expect(height(4)).toBeCloseTo(height(5) / 2);
  });

  it("copes with an all-zero trend", async () => {
    mockGet("/api/v1/reports/trend", {
      months: months.map((month) => ({ month, expense: "0", income: "0" })),
    });
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    expect(groups[0]!.querySelector("rect")).toHaveAttribute("height", "0");
  });
});
