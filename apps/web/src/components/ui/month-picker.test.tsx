import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { MonthPicker } from "./month-picker";

const TODAY = new Date("2026-09-15T06:00:00Z");

function Harness({
  initial = "2026-06",
  onChange,
}: {
  initial?: string;
  onChange?: (m: string) => void;
}) {
  const [month, setMonth] = useState(initial);
  return (
    <MonthPicker
      month={month}
      onChange={(next) => {
        setMonth(next);
        onChange?.(next);
      }}
    />
  );
}

const inDialog = () => within(screen.getByRole("dialog", { name: "Choose month" }));

describe("MonthPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: TODAY });
  });
  afterEach(() => vi.useRealTimers());

  it("shows the month on a button that opens a dialog", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "June 2026" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("has exactly three Tab stops: previous, month, next", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Previous month" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "June 2026" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next month" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("has no hidden native month input", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("input[type='month']")).toBeNull();
  });

  it("steps to the previous and next month and across a year boundary", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<Harness initial="2026-01" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onChange).toHaveBeenNthCalledWith(1, "2025-12");
    expect(onChange).toHaveBeenNthCalledWith(2, "2026-01");
  });

  it("disables next month on the current month", () => {
    render(<Harness initial="2026-09" />);
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("disables future months in the grid", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial="2026-09" />);
    await user.click(screen.getByRole("button", { name: "September 2026" }));
    expect(inDialog().getByRole("button", { name: "October 2026" })).toBeDisabled();
    expect(inDialog().getByRole("button", { name: "August 2026" })).toBeEnabled();
    expect(inDialog().getByRole("button", { name: "Next year" })).toBeDisabled();
  });

  it("marks the current month in the grid", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "June 2026" }));
    expect(inDialog().getByRole("button", { name: "September 2026" })).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("opens with Enter, focuses the selected month and picks with Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Choose month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "June 2026", pressed: true })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-05");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves between months with all four arrow keys", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial="2026-05" />);
    await user.click(screen.getByRole("button", { name: "May 2026" }));
    await user.keyboard("{ArrowDown}");
    expect(inDialog().getByRole("button", { name: "August 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(inDialog().getByRole("button", { name: "September 2026" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(inDialog().getByRole("button", { name: "May 2026" })).toHaveFocus();
  });

  it("does not move focus onto a future month", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial="2026-09" />);
    await user.click(screen.getByRole("button", { name: "September 2026" }));
    await user.keyboard("{ArrowRight}");
    expect(inDialog().getByRole("button", { name: "September 2026" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the month button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "June 2026" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "June 2026" })).toHaveFocus();
  });

  it("closes when pressing outside", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "June 2026" }));
    await user.click(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("steps the year in the grid and picks a month from another year", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "June 2026" }));
    await user.click(inDialog().getByRole("button", { name: "Previous year" }));
    expect(screen.getByText("2025")).toBeInTheDocument();
    await user.click(inDialog().getByRole("button", { name: "March 2025" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2025-03");
  });

  it("opens on the current month, with an enabled focused button, when the month is in the future", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initial="2027-01" />);
    await user.click(screen.getByRole("button", { name: "January 2027" }));
    const focusedButton = inDialog().getByRole("button", { name: "September 2026" });
    expect(focusedButton).toBeEnabled();
    expect(focusedButton).toHaveFocus();
  });
});
