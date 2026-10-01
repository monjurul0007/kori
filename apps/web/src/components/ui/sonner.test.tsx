import { render, screen } from "@testing-library/react";
import { toast } from "sonner";

import { Toaster } from "./sonner";

describe("Toaster", () => {
  it("shows a toast when one is fired", async () => {
    render(<Toaster />);
    toast("Transaction saved");
    expect(await screen.findByText("Transaction saved")).toBeInTheDocument();
  });
});
