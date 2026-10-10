import { render, screen, within } from "@testing-library/react";

import { DayGroup } from "./DayGroup";
import { makeTx } from "./fixtures";

describe("DayGroup", () => {
  it("shows the date heading and one row per transaction", () => {
    render(
      <DayGroup date="2026-09-10" transactions={[makeTx("a"), makeTx("b")]} onSelect={() => {}} />,
    );
    const group = screen.getByRole("region", { name: "Thu, 10 Sep" });
    expect(within(group).getByRole("heading", { name: "Thu, 10 Sep" })).toBeInTheDocument();
    expect(within(group).getAllByRole("listitem")).toHaveLength(2);
  });

  it("subtotals expenses exactly and ignores income", () => {
    render(
      <DayGroup
        date="2026-09-10"
        transactions={[
          makeTx("a", { amount: "0.10" }),
          makeTx("b", { amount: "0.20" }),
          makeTx("c", { type: "income", amount: "5000", merchant: "Salary" }),
        ]}
        onSelect={() => {}}
      />,
    );
    const header = screen.getByRole("heading", { name: "Thu, 10 Sep" }).parentElement!;
    expect(within(header).getByText("৳0.30")).toBeInTheDocument(); // not 0.30000000000000004
  });

  it("shows ৳0 for a day with only income", () => {
    render(
      <DayGroup
        date="2026-09-10"
        transactions={[makeTx("c", { type: "income", amount: "5000" })]}
        onSelect={() => {}}
      />,
    );
    const header = screen.getByRole("heading", { name: "Thu, 10 Sep" }).parentElement!;
    expect(within(header).getByText("৳0")).toBeInTheDocument();
  });
});
