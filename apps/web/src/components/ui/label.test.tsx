import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("names the input it is linked to", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("focuses the input when clicked", async () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );
    await userEvent.click(screen.getByText("Email"));
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });
});
