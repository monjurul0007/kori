import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { addDays, todayInDhaka } from "@/lib/dates";

import { DateQuickPick } from "./DateQuickPick";

describe("DateQuickPick", () => {
  const today = todayInDhaka();

  it("picks today and yesterday", async () => {
    const onChange = vi.fn();
    render(<DateQuickPick id="d" value="2026-01-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenLastCalledWith(today);
    await userEvent.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(onChange).toHaveBeenLastCalledWith(addDays(today, -1));
  });

  it("marks the matching shortcut as active", () => {
    const { rerender } = render(<DateQuickPick id="d" value={today} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Today" })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Yesterday" })).not.toHaveClass("bg-primary");
    rerender(<DateQuickPick id="d" value={addDays(today, -1)} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Yesterday" })).toHaveClass("bg-primary");
  });

  it("uses a date input that cannot go past today", () => {
    render(<DateQuickPick id="d" value={today} onChange={() => {}} />);
    expect(document.getElementById("d")).toHaveAttribute("max", today);
  });
});
