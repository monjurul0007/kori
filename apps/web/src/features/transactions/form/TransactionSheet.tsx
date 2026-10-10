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
}

/** Full-screen under `md`, a centred dialog above. */
export function TransactionSheet({ open, onOpenChange, transaction }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-dvh max-w-none overflow-y-auto rounded-none md:h-auto md:max-h-[90dvh] md:max-w-lg md:rounded-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription className="sr-only">
            {transaction ? "Change or delete this transaction." : "Log a new transaction."}
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={transaction?.id ?? "new"}
          transaction={transaction}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
