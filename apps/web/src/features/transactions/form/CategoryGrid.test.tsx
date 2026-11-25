import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CategoryGrid } from "./CategoryGrid";

const categories = Array.from({ length: 9 }, (_, i) => ({
  id: `c${i}`,
  name: `Cat ${i}`,
  icon: null,
  color: null,
}));

function renderGrid(value = "") {
  const onChange = vi.fn();
  render(<CategoryGrid categories={categories} value={value} onChange={onChange} />);
  return onChange;
}

describe("CategoryGrid", () => {
  it("shows the first seven and a More tile that reveals the rest", async () => {
    renderGrid();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  });

  it("keeps a chosen category visible even beyond the first seven", () => {
    renderGrid("c8");
    expect(screen.getByRole("radio", { name: "Cat 8" })).toHaveAttribute("aria-checked", "true");
  });

  it("reports the picked category", async () => {
    const onChange = renderGrid();
    await userEvent.click(screen.getByRole("radio", { name: "Cat 2" }));
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("is one Tab stop: only the chosen tile is tabbable", () => {
    renderGrid("c3");
    const tabbable = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("Cat 3");
  });

  it("makes the first tile the Tab stop when nothing is chosen", () => {
    renderGrid();
    expect(screen.getByRole("radio", { name: "Cat 0" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Cat 1" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves the chosen category with the arrow keys and wraps around", async () => {
    const onChange = renderGrid("c0");
    screen.getByRole("radio", { name: "Cat 0" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("c1");
    expect(screen.getByRole("radio", { name: "Cat 1" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("c6"); // wrapped to the last of the seven shown
  });

  it("leaves the grid in one Tab press, to the More tile", async () => {
    renderGrid("c2");
    screen.getByRole("radio", { name: "Cat 2" }).focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("keeps the More tile outside the radiogroup", () => {
    renderGrid();
    expect(screen.getByRole("radiogroup")).not.toContainElement(
      screen.getByRole("button", { name: "More" }),
    );
  });
});
