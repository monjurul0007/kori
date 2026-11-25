import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("is named by its aria-label and handles clicks", async () => {
    const onClick = vi.fn();
    render(<IconButton aria-label="Close" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has a 44px hit area on coarse pointers and 40px otherwise", () => {
    render(<IconButton aria-label="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "h-10",
      "w-10",
      "[@media(pointer:coarse)]:h-11",
      "[@media(pointer:coarse)]:w-11",
    );
  });

  it("does not submit a surrounding form", () => {
    render(<IconButton aria-label="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("type", "button");
  });

  it("refuses to compile without a label", () => {
    // @ts-expect-error aria-label is required
    render(<IconButton />);
  });
});
