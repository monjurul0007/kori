import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RemovableChip } from "./removable-chip";

describe("RemovableChip", () => {
  it("names its remove button after the tag and calls onRemove", async () => {
    const onRemove = vi.fn();
    render(<RemovableChip label="office" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove tag office" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("gives the remove button a hit area of at least 32px", () => {
    render(<RemovableChip label="office" onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove tag office" })).toHaveClass("h-8", "w-8");
  });
});

describe("RemovableChip remove label", () => {
  it("starts the button's name with the given removeLabel", () => {
    render(<RemovableChip label="Bills" removeLabel="Remove filter" onRemove={() => {}} />);
    expect(screen.getByRole("button", { name: "Remove filter Bills" })).toBeInTheDocument();
  });
});
