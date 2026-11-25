import { toast } from "sonner";

import { toastSuccess } from "./toast";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("toastSuccess", () => {
  it("shows a plain message with no action", () => {
    toastSuccess("Saved ৳320 to Food");
    expect(toast.success).toHaveBeenCalledWith("Saved ৳320 to Food", undefined);
  });

  it("calls the undo callback from the Undo action", () => {
    const undo = vi.fn();
    toastSuccess("Deleted", { undo });
    const options = vi.mocked(toast.success).mock.calls.at(-1)?.[1];
    expect(options?.action).toMatchObject({ label: "Undo" });
    const { onClick } = options?.action as { onClick: (event: unknown) => void };
    onClick(undefined);
    expect(undo).toHaveBeenCalledOnce();
  });
});
