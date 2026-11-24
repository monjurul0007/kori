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

  const header = () => screen.getByRole("heading", { name: "Thu, 10 Sep" }).parentElement!;

  it("labels an expense-only day as Spent, summed exactly", () => {
    render(
      <DayGroup
        date="2026-09-10"
        transactions={[makeTx("a", { amount: "0.10" }), makeTx("b", { amount: "0.20" })]}
        onSelect={() => {}}
      />,
    );
    expect(within(header()).getByText("Spent ৳0.30")).toBeInTheDocument(); // not 0.30000000000000004
    expect(within(header()).queryByText(/in$/)).not.toBeInTheDocument();
    expect(within(header()).getByText("Thu, 10 Sep: spent ৳0.30")).toBeInTheDocument();
  });

  it("shows only income on an income-only day, never a bare ৳0", () => {
    render(
      <DayGroup
        date="2026-09-10"
        transactions={[makeTx("c", { type: "income", amount: "5000" })]}
        onSelect={() => {}}
      />,
    );
    expect(within(header()).getByText("+৳5,000 in")).toBeInTheDocument();
    expect(within(header()).queryByText(/Spent/)).not.toBeInTheDocument();
    expect(within(header()).queryByText("৳0")).not.toBeInTheDocument();
    expect(within(header()).getByText("Thu, 10 Sep: income ৳5,000")).toBeInTheDocument();
  });

  it("shows both figures on a mixed day", () => {
    render(
      <DayGroup
        date="2026-09-10"
        transactions={[
          makeTx("a", { amount: "630" }),
          makeTx("c", { type: "income", amount: "50000", merchant: "Salary" }),
        ]}
        onSelect={() => {}}
      />,
    );
    expect(within(header()).getByText("Spent ৳630")).toBeInTheDocument();
    expect(within(header()).getByText("+৳50,000 in")).toBeInTheDocument();
    expect(
      within(header()).getByText("Thu, 10 Sep: spent ৳630, income ৳50,000"),
    ).toBeInTheDocument();
  });
});
