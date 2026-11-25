import { useCallback, useEffect, useRef, useState } from "react";

import { DiscardPrompt } from "@/components/ui/discard-prompt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Transaction } from "../TransactionRow";
import { NewTransactionSheet } from "./NewTransactionSheet";
import { TransactionForm } from "./TransactionForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit mode, absent for create mode. */
  transaction?: Transaction;
  /** Starting date for a new entry (create mode); defaults to today. */
  defaultDate?: string;
}

/** Full-screen under `md`, a centred dialog above. Asks before discarding typed input. */
export function TransactionSheet({ open, onOpenChange, transaction, defaultDate }: Props) {
  if (!transaction) {
    return (
      <NewTransactionSheet open={open} onOpenChange={onOpenChange} defaultDate={defaultDate} />
    );
  }
  return <EditTransactionSheet open={open} onOpenChange={onOpenChange} transaction={transaction} />;
}

type EditProps = Omit<Props, "defaultDate"> & { transaction: Transaction };

/** Edit and delete keep the dialog until DR-08 moves them into the new sheet. */
function EditTransactionSheet({ open, onOpenChange, transaction }: EditProps) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirming) {
      contentRef.current?.querySelector<HTMLElement>("[role=alertdialog] button")?.focus();
    }
  }, [confirming]);

  const close = useCallback(() => {
    setDirty(false);
    setConfirming(false);
    setConfirmingDelete(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Esc, an overlay click and the × button all arrive here as `next === false`.
  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      setConfirming(true);
      return;
    }
    if (!next) close();
    else onOpenChange(next);
  };

  const keepEditing = () => {
    setConfirming(false);
    contentRef.current?.querySelector<HTMLElement>("input")?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={contentRef}
        onEscapeKeyDown={(e) => {
          // Esc backs out of "Delete this transaction?" without closing the sheet.
          // While the request is in flight Esc does nothing, like the disabled buttons.
          if (confirmingDelete) {
            e.preventDefault();
            if (!deletePending) setConfirmingDelete(false);
          }
        }}
        className="flex h-dvh max-w-none flex-col overflow-hidden rounded-none md:h-auto md:max-h-[90dvh] md:max-w-lg md:rounded-lg"
      >
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription className="sr-only">
            Change or delete this transaction.
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={transaction.id}
          transaction={transaction}
          onDone={close}
          onDirtyChange={setDirty}
          confirmingDelete={confirmingDelete}
          onConfirmingDeleteChange={setConfirmingDelete}
          onDeletePendingChange={setDeletePending}
        />
        {confirming && (
          <DiscardPrompt
            title="Discard this transaction?"
            onKeepEditing={keepEditing}
            onDiscard={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
