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
  it("draws a donut with one slice per category and lists amounts and percents", async () => {
    mockGet(
      "/api/v1/reports/spending",
      report([row("a", "6000", "75.0"), row("b", "2000", "25.0")]),
    );
    renderCard(<CategoryBreakdown month="2026-09" />);
    const donut = await screen.findByRole("img", { name: "Spending by category, total ৳8,000" });
    expect(donut.querySelectorAll("circle")).toHaveLength(2);
    const list = screen.getByRole("list");
    expect(within(list).getByText("Cat a")).toBeInTheDocument();
    expect(within(list).getByText("৳6,000 · 75.0%")).toBeInTheDocument();
    expect(within(list).getByText("৳2,000 · 25.0%")).toBeInTheDocument();
  });

  it("starts each slice where the previous one ended", async () => {
    mockGet(
      "/api/v1/reports/spending",
      report([row("a", "6000", "75.0"), row("b", "2000", "25.0")]),
    );
    renderCard(<CategoryBreakdown month="2026-09" />);
    const donut = await screen.findByRole("img");
    const [first, second] = [...donut.querySelectorAll("circle")];
    expect(Number(first!.getAttribute("stroke-dashoffset"))).toBeCloseTo(0);
    const firstLength = Number(first!.getAttribute("stroke-dasharray")!.split(" ")[0]);
    expect(Number(second!.getAttribute("stroke-dashoffset"))).toBeCloseTo(-firstLength);
  });

  it("rolls categories beyond the top 6 into Other", async () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => row(id, "100", "12.5"));
    mockGet("/api/v1/reports/spending", report(rows, "800"));
    renderCard(<CategoryBreakdown month="2026-09" />);
    expect(await screen.findByText("Other")).toBeInTheDocument();
    expect(screen.getByText("৳200 · 25.0%")).toBeInTheDocument();
    expect(screen.queryByText("Cat h")).not.toBeInTheDocument();
  });

  it("says so when there is no spending", async () => {
    mockGet("/api/v1/reports/spending", report([], "0"));
    renderCard(<CategoryBreakdown month="2026-09" />);
    expect(await screen.findByText("No spending this month.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
