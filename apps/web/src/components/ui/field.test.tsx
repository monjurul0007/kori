import { render, screen } from "@testing-library/react";

import { Field } from "./field";
import { Input } from "./input";

function renderField(props: { hint?: string; error?: string }) {
  render(
    <Field label="Amount" {...props}>
      {(control) => <Input {...control} />}
    </Field>,
  );
  return screen.getByRole("textbox", { name: "Amount" });
}

describe("Field", () => {
  it("links the label to the control", () => {
    expect(renderField({})).toBeInTheDocument();
  });

  it("has no aria wiring when there is no hint or error", () => {
    const input = renderField({});
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("describes the control by its error and marks it invalid", () => {
    const input = renderField({ error: "Must be above zero" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Must be above zero");
  });

  it("describes the control by its hint and error together", () => {
    const input = renderField({ hint: "In taka", error: "Enter an amount" });
    expect(input).toHaveAccessibleDescription("In taka Enter an amount");
  });
});
