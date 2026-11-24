import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Transaction } from "../TransactionRow";
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
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription className="sr-only">
            {transaction ? "Change or delete this transaction." : "Log a new transaction."}
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={transaction?.id ?? "new"}
          transaction={transaction}
          defaultDate={defaultDate}
          onDone={close}
          onDirtyChange={setDirty}
          confirmingDelete={confirmingDelete}
          onConfirmingDeleteChange={setConfirmingDelete}
          onDeletePendingChange={setDeletePending}
        />
        {confirming && (
          <div
            role="alertdialog"
            aria-label="Discard this transaction?"
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6"
          >
            <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-4 shadow-lg">
              <p className="font-medium">Discard this transaction?</p>
              <p className="text-sm text-muted-foreground">What you typed will be lost.</p>
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={keepEditing}>
                  Keep editing
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={close}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
