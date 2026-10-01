import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input } from "./input";

describe("Input", () => {
  it("accepts typed text", async () => {
    render(<Input aria-label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.type(input, "1250.50");
    expect(input).toHaveValue("1250.50");
  });

  it("passes through type, placeholder and disabled", () => {
    render(<Input type="password" placeholder="Password" disabled />);
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toBeDisabled();
  });

  it("merges a custom className", () => {
    render(<Input aria-label="Note" className="w-1/2" />);
    expect(screen.getByRole("textbox")).toHaveClass("w-1/2", "rounded-md");
  });
});
