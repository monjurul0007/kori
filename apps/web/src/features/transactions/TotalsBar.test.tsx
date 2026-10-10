import { render, screen, within } from "@testing-library/react";

import { TotalsBar } from "./TotalsBar";

const value = (label: string) => within(screen.getByText(label).parentElement!).getByText(/৳/);

describe("TotalsBar", () => {
  it("shows spent, income and net", () => {
    render(<TotalsBar expense="1250.50" income="2000" />);
    expect(value("Spent")).toHaveTextContent("৳1,250.50");
    expect(value("Income")).toHaveTextContent("৳2,000");
    expect(value("Net")).toHaveTextContent("৳749.50");
  });

  it("shows a negative net when spending exceeds income", () => {
    render(<TotalsBar expense="500" income="120.25" />);
    expect(value("Net")).toHaveTextContent("-৳379.75");
  });

  it("is exact where floats are not", () => {
    render(<TotalsBar expense="0.10" income="0.30" />);
    expect(value("Net")).toHaveTextContent("৳0.20");
  });

  it("handles an empty month", () => {
    render(<TotalsBar expense="0" income="0" />);
    expect(value("Net")).toHaveTextContent("৳0");
  });
});
