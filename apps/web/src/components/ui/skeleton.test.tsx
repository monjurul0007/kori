import { render, screen } from "@testing-library/react";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder with the given size", () => {
    render(<Skeleton aria-label="Loading" className="h-5 w-32" />);
    expect(screen.getByLabelText("Loading")).toHaveClass("animate-pulse", "h-5", "w-32");
  });
});
