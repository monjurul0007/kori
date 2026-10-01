import { render, screen } from "@testing-library/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("renders its parts", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>September</CardTitle>
          <CardDescription>Monthly summary</CardDescription>
        </CardHeader>
        <CardContent>৳12,50,000</CardContent>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "September" })).toBeInTheDocument();
    expect(screen.getByText("Monthly summary")).toBeInTheDocument();
    expect(screen.getByText("৳12,50,000")).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(<Card data-testid="card" className="max-w-sm" />);
    expect(screen.getByTestId("card")).toHaveClass("max-w-sm", "rounded-lg", "border");
  });
});
