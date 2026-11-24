import { toast } from "sonner";

import { ApiError } from "@/api/client";

/** Show an error toast built from a problem+json `title` and `detail`. */
export function toastError(error: unknown) {
  if (error instanceof ApiError) {
    const { title, detail } = error.problem;
    toast.error(title, detail && detail !== title ? { description: detail } : undefined);
    return;
  }
  toast.error("Something went wrong", {
    description: error instanceof Error ? error.message : undefined,
  });
}

/** A plain success toast; with `undo`, it carries an "Undo" action. */
export function toastSuccess(message: string, options: { undo?: () => void | Promise<void> } = {}) {
  toast.success(
    message,
    options.undo ? { action: { label: "Undo", onClick: () => void options.undo?.() } } : undefined,
  );
}
