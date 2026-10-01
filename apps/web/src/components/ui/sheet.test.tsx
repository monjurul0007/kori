import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

function Example({ side }: { side?: "left" | "right" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Menu</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Go to a page.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("opens from the trigger and closes with the close button", async () => {
    render(<Example />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("dialog", { name: "Navigation" })).toHaveAccessibleDescription(
      "Go to a page.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["right", "right-0"],
    ["left", "left-0"],
    ["bottom", "bottom-0"],
  ] as const)("anchors to the %s edge", async (side, expectedClass) => {
    render(<Example side={side} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("dialog")).toHaveClass(expectedClass);
  });
});
