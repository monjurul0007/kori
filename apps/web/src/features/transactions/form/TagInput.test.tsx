import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { TagInput } from "./TagInput";

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput id="t" value={tags} onChange={setTags} known={["eid", "lunch", "Eidgah"]} />;
}

describe("TagInput", () => {
  it("creates a tag on Enter, stripping a leading #", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("textbox"), "#trip{Enter}");
    expect(screen.getByText("#trip")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("ignores empty input and duplicates (case-insensitive)", async () => {
    render(<Harness initial={["Trip"]} />);
    await userEvent.type(screen.getByRole("textbox"), "{Enter}trip{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("suggests known tags by prefix, excluding ones already added", async () => {
    render(<Harness initial={["eid"]} />);
    await userEvent.type(screen.getByRole("textbox"), "ei");
    const suggestions = screen.getByRole("list", { name: "Tag suggestions" });
    expect(suggestions).toHaveTextContent("#Eidgah");
    expect(suggestions).not.toHaveTextContent("#eid#");
    expect(screen.queryByRole("button", { name: "#lunch" })).not.toBeInTheDocument();
  });

  it("adds a suggestion on click and removes a tag", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("textbox"), "lu");
    await userEvent.click(screen.getByRole("button", { name: "#lunch" }));
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
    await userEvent.type(screen.getByRole("textbox"), "x{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
