import { useEffect, useRef, useState } from "react";

import { formatTaka } from "@/lib/money";
import { toastError, toastSuccess } from "@/lib/toast";
import { OFFLINE_MESSAGE } from "@/pwa/useOnline";

import type { Transaction } from "../TransactionRow";
import { useDeleteTransaction, type TransactionBody } from "./mutations";

export interface DeleteFlow {
  isConfirming: boolean;
  isPending: boolean;
  /** Set when the delete could not even be tried, e.g. while offline. */
  error: string | undefined;
  deleteButtonRef: React.RefObject<HTMLButtonElement | null>;
  askToConfirm: () => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

/** Delete with an inline "are you sure?" step; the toast has no Undo because re-creating the row would change its id. */
export function useDeleteFlow(transaction: Transaction, onDeleted: () => void): DeleteFlow {
  const remove = useDeleteTransaction(transaction.id);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Cancel takes focus when the confirm opens (DeleteConfirm); Delete gets it back after.
    if (wasConfirming.current && !isConfirming) deleteButtonRef.current?.focus();
    wasConfirming.current = isConfirming;
  }, [isConfirming]);

  const confirm = async () => {
    if (!navigator.onLine) {
      setIsConfirming(false);
      setError(OFFLINE_MESSAGE);
      return;
    }
    setError(undefined);
    try {
      await remove.mutateAsync({ body: {} as TransactionBody, preview: transaction });
      const what = transaction.merchant || transaction.note;
      toastSuccess(`Deleted ${formatTaka(transaction.amount)}${what ? ` · ${what}` : ""}`);
      onDeleted();
    } catch (e) {
      setIsConfirming(false);
      toastError(e);
    }
  };

  return {
    isConfirming,
    isPending: remove.isPending,
    error,
    deleteButtonRef,
    askToConfirm: () => setIsConfirming(true),
    cancel: () => setIsConfirming(false),
    confirm,
  };
}
