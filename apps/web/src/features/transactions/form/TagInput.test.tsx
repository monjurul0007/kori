import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { TagInput } from "./TagInput";

const KNOWN = ["eid", "lunch", "eidgah"];

function Harness({ initial = [] as string[], known = KNOWN }) {
  const [tags, setTags] = useState(initial);
  return <TagInput id="t" value={tags} onChange={setTags} known={known} />;
}

const combobox = () => screen.getByRole("combobox");

describe("TagInput", () => {
  it("creates a tag on Enter, stripping a leading #", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "#trip{Enter}");
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#trip");
    expect(combobox()).toHaveValue("");
  });

  it("shows the chip as the API will save it", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "QA Mixed Case{Enter}");
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#qa-mixed-case");
  });

  it("ignores empty input and duplicates that match after normalising", async () => {
    render(<Harness initial={["qa-mixed-case"]} />);
    await userEvent.type(combobox(), "{Enter}QA Mixed Case{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("suggests known tags by prefix, excluding ones already added", async () => {
    render(<Harness initial={["eid"]} />);
    await userEvent.type(combobox(), "ei");
    expect(screen.getByRole("option", { name: "eidgah" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "eid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "lunch" })).not.toBeInTheDocument();
  });

  it("shows at most eight suggestions", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `trip-${i}`);
    render(<Harness known={many} />);
    await userEvent.type(combobox(), "trip");
    const suggestions = screen
      .getAllByRole("option")
      .filter((o) => !o.textContent?.startsWith("Create"));
    expect(suggestions).toHaveLength(8);
  });

  it("offers to create text that is not an existing tag", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "Road Trip");
    await userEvent.click(screen.getByRole("option", { name: 'Create "road-trip"' }));
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#road-trip");
  });

  it("does not offer to create a tag that already exists", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "lunch");
    expect(screen.queryByRole("option", { name: /^Create/ })).not.toBeInTheDocument();
  });

  it("picks a suggestion with the arrow keys and Enter", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "ei{ArrowDown}{ArrowDown}");
    expect(combobox()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "eidgah" }).id,
    );
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#eidgah");
  });

  it("wires the combobox to its listbox", async () => {
    render(<Harness />);
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    await userEvent.type(combobox(), "ei");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(combobox()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("closes the suggestions on Escape", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "ei{Escape}");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("keeps Escape from reaching the surrounding sheet while the list is open", async () => {
    const onParentKeyDown = vi.fn();
    render(
      <div role="presentation" onKeyDown={onParentKeyDown}>
        <Harness />
      </div>,
    );
    await userEvent.type(combobox(), "ei");
    onParentKeyDown.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("gives the remove button a 32px hit area", () => {
    render(<Harness initial={["trip"]} />);
    expect(screen.getByRole("button", { name: "Remove tag trip" })).toHaveClass("h-8", "w-8");
  });

  it("adds a suggestion on click and removes a tag", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "lu");
    await userEvent.click(screen.getByRole("option", { name: "lunch" }));
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#lunch");
    await userEvent.click(screen.getByRole("button", { name: "Remove tag lunch" }));
    expect(screen.queryByRole("list", { name: "Selected tags" })).not.toBeInTheDocument();
  });

  it("does not submit an enclosing form on Enter", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    await userEvent.type(combobox(), "x{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("adds typed text as a chip when the field loses focus", async () => {
    render(<Harness />);
    await userEvent.type(combobox(), "#lunch");
    await userEvent.tab();
    expect(screen.getByRole("list", { name: "Selected tags" })).toHaveTextContent("#lunch");
    expect(combobox()).toHaveValue("");
  });

  it("adds nothing on blur for whitespace-only text or a duplicate", async () => {
    render(<Harness initial={["trip"]} />);
    await userEvent.type(combobox(), "   ");
    await userEvent.tab();
    await userEvent.type(combobox(), "Trip");
    await userEvent.tab();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
