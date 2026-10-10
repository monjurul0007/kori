import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MonthSwitcher } from "./MonthSwitcher";

describe("MonthSwitcher", () => {
  it("shows the month name", () => {
    render(<MonthSwitcher month="2026-09" onChange={() => {}} />);
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  it("steps to the previous and next month", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher month="2026-09" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onChange).toHaveBeenNthCalledWith(1, "2026-08");
    expect(onChange).toHaveBeenNthCalledWith(2, "2026-10");
  });

  it("crosses year boundaries", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher month="2026-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onChange).toHaveBeenCalledWith("2025-12");
  });

  it("picks any month from the native picker", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher month="2026-09" onChange={onChange} />);
    const picker = screen.getByLabelText("Pick month");
    fireEvent.change(picker, { target: { value: "2026-03" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-03");
    fireEvent.change(picker, { target: { value: "" } }); // cleared picker is ignored
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
