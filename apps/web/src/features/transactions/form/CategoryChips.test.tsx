import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CategoryChips } from "./CategoryChips";

const make = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Cat ${i}` }));

describe("CategoryChips", () => {
  it("shows every category when there are 8 or fewer, without More", () => {
    render(<CategoryChips categories={make(8)} value="" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "More…" })).not.toBeInTheDocument();
  });

  it("shows the first 8 and reveals the rest with More", async () => {
    render(<CategoryChips categories={make(12)} value="" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    await userEvent.click(screen.getByRole("button", { name: "More…" }));
    expect(screen.getAllByRole("radio")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: "More…" })).not.toBeInTheDocument();
  });

  it("keeps a selected category beyond the top 8 visible", () => {
    render(<CategoryChips categories={make(12)} value="c10" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Cat 10" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(9);
  });

  it("reports the picked category", async () => {
    const onChange = vi.fn();
    render(<CategoryChips categories={make(3)} value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Cat 1" }));
    expect(onChange).toHaveBeenCalledWith("c1");
  });
});
