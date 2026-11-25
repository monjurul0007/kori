import { render } from "@testing-library/react";

import { CategoryTile } from "./category-tile";

describe("CategoryTile", () => {
  it("washes the tile in the category colour and hides itself from screen readers", () => {
    const { container } = render(<CategoryTile icon="utensils" color="#ea580c" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile.style.backgroundColor).toContain("rgb(234, 88, 12) 14%");
  });

  it("falls back to a neutral tile when the category has no colour", () => {
    const { container } = render(<CategoryTile icon={null} color={null} />);
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe("");
  });
});
