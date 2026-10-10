import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PaymentMethodSelect } from "./PaymentMethodSelect";

const methods = [
  { id: "pm1", name: "bKash" },
  { id: "pm2", name: "Cash" },
];

describe("PaymentMethodSelect", () => {
  it("lists None plus each method and shows the selection", () => {
    render(<PaymentMethodSelect id="p" methods={methods} value="pm2" onChange={() => {}} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "None",
      "bKash",
      "Cash",
    ]);
    expect(screen.getByRole("combobox")).toHaveValue("pm2");
  });

  it("reports the chosen id, and empty for None", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodSelect id="p" methods={methods} value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "bKash");
    expect(onChange).toHaveBeenLastCalledWith("pm1");
    await userEvent.selectOptions(screen.getByRole("combobox"), "None");
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
