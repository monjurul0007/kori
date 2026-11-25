import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FormSheet } from "./form-sheet";

function renderSheet({ dirty = false } = {}) {
  const onOpenChange = vi.fn();
  render(
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title="Add expense"
      description="Log a new expense."
      dirty={dirty}
      footer={<button type="button">Save</button>}
    >
      <input aria-label="Merchant" />
    </FormSheet>,
  );
  return onOpenChange;
}

describe("FormSheet", () => {
  it("always renders the footer actions next to the body", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Merchant" })).toBeVisible();
  });

  it.each([
    ["Esc", () => userEvent.keyboard("{Escape}")],
    ["the close button", () => userEvent.click(screen.getByRole("button", { name: "Close" }))],
  ])("closes at once on %s when nothing was typed", async (_name, act) => {
    const onOpenChange = renderSheet();
    await act();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([
    ["Esc", () => userEvent.keyboard("{Escape}")],
    ["the close button", () => userEvent.click(screen.getByRole("button", { name: "Close" }))],
  ])("asks before discarding on %s when the form is dirty", async (_name, act) => {
    const onOpenChange = renderSheet({ dirty: true });
    await act();
    expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks before discarding on an overlay click when the form is dirty", async () => {
    const onOpenChange = renderSheet({ dirty: true });
    const overlay = document.body.querySelector("[data-state=open].fixed.inset-0.bg-scrim");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the sheet open on Keep editing and closes on Discard", async () => {
    const onOpenChange = renderSheet({ dirty: true });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns focus to the field that had it when you choose Keep editing", async () => {
    renderSheet({ dirty: true });
    await userEvent.click(screen.getByRole("textbox", { name: "Merchant" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Merchant" })).toHaveFocus();
  });

  it("backs out of the discard prompt with Esc instead of closing", async () => {
    const onOpenChange = renderSheet({ dirty: true });
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("FormSheet reopened after a parent-driven close", () => {
  it("does not show the discard prompt again", async () => {
    const props = {
      onOpenChange: vi.fn(),
      title: "Add expense",
      description: "Log a new expense.",
      dirty: true,
      footer: <button type="button">Save</button>,
    };
    const { rerender } = render(
      <FormSheet {...props} open>
        {null}
      </FormSheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeVisible();

    rerender(
      <FormSheet {...props} open={false}>
        {null}
      </FormSheet>,
    );
    rerender(
      <FormSheet {...props} open>
        {null}
      </FormSheet>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
