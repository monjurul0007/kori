import { render, screen } from "@testing-library/react";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows the sentence and the one action", () => {
    render(<EmptyState message="No transactions yet." action={<button>Add one</button>} />);
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one" })).toBeInTheDocument();
  });

  it("works without an action", () => {
    render(<EmptyState variant="no-results" message="Nothing matches that search." />);
    expect(screen.getByText("Nothing matches that search.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("announces the error variant as an alert", () => {
    render(<EmptyState variant="error" message="We couldn't load this." />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load this.");
  });

  it("does not announce the empty variant", () => {
    render(<EmptyState message="Nothing here." />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a heading above the message when given one", () => {
    render(<EmptyState heading="Your spending will show here" message="Trends appear later." />);
    expect(screen.getByText("Your spending will show here")).toBeInTheDocument();
    expect(screen.getByText("Trends appear later.")).toBeInTheDocument();
  });
});
