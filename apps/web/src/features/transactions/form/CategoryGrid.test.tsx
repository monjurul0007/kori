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
});
