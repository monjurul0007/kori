import type { Transaction } from "../TransactionRow";
import { QuickEntrySheet } from "./QuickEntrySheet";
import { useCreateWithUndo } from "./useCreateWithUndo";
import { useDeleteFlow } from "./useDeleteFlow";
import { useUpdateWithToast } from "./useUpdateWithToast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit mode, absent for create mode. */
  transaction?: Transaction;
  /** Starting date for a new entry (create mode); defaults to today. */
  defaultDate?: string;
}

/** Add, edit and delete share one quick-entry sheet; this picks what Save and Delete do. */
export function TransactionSheet({ open, onOpenChange, transaction, defaultDate }: Props) {
  if (!transaction) {
    return <AddSheet open={open} onOpenChange={onOpenChange} defaultDate={defaultDate} />;
  }
  return <EditSheet open={open} onOpenChange={onOpenChange} transaction={transaction} />;
}

function AddSheet({ open, onOpenChange, defaultDate }: Omit<Props, "transaction">) {
  const createWithUndo = useCreateWithUndo();
  return (
    <QuickEntrySheet
      open={open}
      onOpenChange={onOpenChange}
      defaultDate={defaultDate}
      onSave={(submission) =>
        createWithUndo(submission, submission.preview.lines[0]?.category.name)
      }
    />
  );
}

function EditSheet({
  open,
  onOpenChange,
  transaction,
}: Omit<Props, "defaultDate"> & { transaction: Transaction }) {
  const updateWithToast = useUpdateWithToast(transaction.id);
  const deletion = useDeleteFlow(transaction, () => onOpenChange(false));
  return (
    <QuickEntrySheet
      open={open}
      onOpenChange={onOpenChange}
      transaction={transaction}
      onSave={updateWithToast}
      deletion={deletion}
    />
  );
}
