import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";

import { TrendChart } from "./TrendChart";
import { mockGet, renderCard } from "./testHelpers";

const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const trend = (expenses: string[], income = "5000") => ({
  months: months.map((month, i) => ({ month, expense: expenses[i]!, income })),
});
const noBudget = { overall: null, categories: [], days_left: 0 };
const overallBudget = (limit: string) => ({ ...noBudget, overall: { limit } });
const mockBudget = (body: unknown) =>
  server.use(http.get("*/api/v1/reports/budget-status", () => HttpResponse.json(body as object)));

beforeEach(() => mockBudget(noBudget));

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

  it("describes the chart as an image that points to the table", async () => {
    mockGet("/api/v1/reports/trend", trend(["1", "2", "3", "4", "5", "6"]));
    renderCard(<TrendChart month="2026-09" />);
    expect(await screen.findByRole("img", { name: /expenses only.*table below/ })).toBeVisible();
  });

  it("shows expenses only by default", async () => {
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "3000", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    expect(groups.every((g) => g.querySelectorAll("rect").length === 1)).toBe(true);
    expect(screen.getByRole("button", { name: "Show income" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("adds an income bar to every month when income is switched on", async () => {
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "3000", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    await userEvent.click(await screen.findByRole("button", { name: "Show income" }));
    const groups = screen.getAllByTestId("trend-bar");
    expect(groups.every((g) => g.querySelectorAll("rect").length === 2)).toBe(true);
    expect(screen.getByRole("button", { name: "Show income" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("labels every bar with its value", async () => {
    mockGet("/api/v1/reports/trend", trend(["880", "2000", "31200", "4000", "5000", "27400"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const label = (i: number) => groups[i]!.querySelector("text")?.textContent;
    expect([label(0), label(2), label(5)]).toEqual(["880", "31.2k", "27.4k"]);
  });

  it("gives the axis round ticks that cover the largest bar", async () => {
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "33400", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    const ticks = await screen.findAllByTestId("axis-tick");
    expect(ticks.map((t) => t.querySelector("text")?.textContent)).toEqual([
      "0",
      "15k",
      "30k",
      "45k",
    ]);
  });

  it("keeps a small expense visible next to a large one", async () => {
    mockGet("/api/v1/reports/trend", trend(["5", "0", "0", "0", "0", "1250000"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const height = (i: number) => Number(groups[i]!.querySelector("rect")!.getAttribute("height"));
    expect(height(0)).toBeGreaterThanOrEqual(2);
    expect(height(1)).toBe(0);
  });

  it("highlights only the selected month", async () => {
    mockGet("/api/v1/reports/trend", trend(["1", "2", "3", "4", "5", "6"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const solid = groups.filter((g) => g.querySelector("rect")?.classList.contains("fill-primary"));
    expect(solid.map((g) => g.dataset.month)).toEqual(["2026-09"]);
  });

  it("scales bar heights in proportion to their values", async () => {
    mockGet("/api/v1/reports/trend", trend(["0", "0", "0", "0", "2500", "5000"]));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    const height = (i: number) => Number(groups[i]!.querySelector("rect")!.getAttribute("height"));
    expect(height(0)).toBe(0);
    expect(height(4)).toBeCloseTo(height(5) / 2);
  });

  it("copes with an all-zero trend", async () => {
    mockGet("/api/v1/reports/trend", trend(["0", "0", "0", "0", "0", "0"], "0"));
    renderCard(<TrendChart month="2026-09" />);
    const groups = await screen.findAllByTestId("trend-bar");
    expect(groups[0]!.querySelector("rect")).toHaveAttribute("height", "0");
    expect(screen.getAllByTestId("axis-tick")).toHaveLength(1);
  });

  it("draws a labelled budget line when there is an overall budget", async () => {
    mockBudget(overallBudget("40000"));
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "3000", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    const line = await screen.findByTestId("budget-line");
    expect(line).toHaveTextContent("Budget ৳40k");
  });

  it("draws no budget line without an overall budget", async () => {
    mockGet("/api/v1/reports/trend", trend(["1000", "2000", "3000", "4000", "5000", "6000"]));
    renderCard(<TrendChart month="2026-09" />);
    await screen.findAllByTestId("trend-bar");
    expect(screen.queryByTestId("budget-line")).not.toBeInTheDocument();
  });
});
