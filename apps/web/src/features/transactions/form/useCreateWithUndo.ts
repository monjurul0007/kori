import { formatTaka } from "@/lib/money";
import { toastError, toastSuccess } from "@/lib/toast";

import type { Submission } from "./submission";
import { useCreateTransaction, useRemoveTransaction } from "./mutations";

/** Creates a transaction and confirms it with a toast whose Undo deletes exactly that row. */
export function useCreateWithUndo() {
  const create = useCreateTransaction();
  const undoCreate = useRemoveTransaction();
  return async (submission: Submission, categoryName: string | undefined) => {
    const created = await create.mutateAsync(submission);
    const where = submission.preview.is_split
      ? "as a split"
      : `to ${categoryName ?? "your transactions"}`;
    toastSuccess(`Saved ${formatTaka(submission.body.amount)} ${where}`, {
      undo: async () => {
        try {
          await undoCreate.mutateAsync(created.id);
          toastSuccess("Removed");
        } catch (e) {
          toastError(e);
        }
      },
    });
  };
}
