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
