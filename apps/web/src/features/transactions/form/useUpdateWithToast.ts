import { toastSuccess } from "@/lib/toast";

import { useUpdateTransaction } from "./mutations";
import type { Submission } from "./submission";

/** Saves changes to an existing transaction and confirms with a toast. */
export function useUpdateWithToast(id: string) {
  const update = useUpdateTransaction(id);
  return async (submission: Submission) => {
    await update.mutateAsync(submission);
    toastSuccess("Saved changes");
  };
}
