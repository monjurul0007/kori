import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "./button";

describe("Button", () => {
  it("renders its label and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant and size classes and merges a custom className", () => {
    render(
      <Button variant="outline" size="sm" className="w-full">
        Cancel
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveClass("border", "h-9", "w-full");
    expect(button).not.toHaveClass("bg-primary");
  });

  it("renders the child element instead of a button with asChild", () => {
    render(
      <Button asChild>
        <a href="/transactions">Transactions</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Transactions" });
    expect(link).toHaveAttribute("href", "/transactions");
    expect(link).toHaveClass("bg-primary");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
