import { render, screen } from "@testing-library/react";

import { Money } from "./money";

describe("Money", () => {
  it("formats a decimal string in taka with lakh grouping", () => {
    render(<Money amount="1250000.5" />);
    expect(screen.getByText("৳12,50,000.50")).toBeInTheDocument();
  });

  it("uses tabular figures in the display font", () => {
    render(<Money amount="320" />);
    expect(screen.getByText("৳320")).toHaveClass("tabular-nums", "font-display");
  });

  it("shows a plus sign for income when asked", () => {
    render(<Money amount="500" sign variant="income" />);
    expect(screen.getByText("+৳500")).toHaveClass("text-income");
  });

  it("shows no plus sign without the sign prop", () => {
    render(<Money amount="500" />);
    expect(screen.getByText("৳500")).toBeInTheDocument();
  });

  it("never adds a plus sign to zero or a negative amount", () => {
    render(
      <>
        <Money amount="0" sign />
        <Money amount="-150" sign variant="over" />
      </>,
    );
    expect(screen.getByText("৳0")).toBeInTheDocument();
    expect(screen.getByText("-৳150")).toHaveClass("text-over");
  });
});
