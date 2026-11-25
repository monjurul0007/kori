import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMonth } from "@/lib/dates";
import { formatTaka, parseTakaInput } from "@/lib/money";
import { toastError, toastSuccess } from "@/lib/toast";

import { useSetBudget } from "./hooks";

export interface BudgetTarget {
  /** null is the overall limit. */
  categoryId: string | null;
  name: string;
  /** The current limit, if one is set. */
  amount?: string;
}

/** Message for a 422 on the amount (or month) from the API's `errors[]`. */
function fieldMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.response.status !== 422) return null;
  const errors = Array.isArray(error.problem.errors) ? error.problem.errors : [];
  const first = (errors as { msg?: string }[])[0];
  return first?.msg ?? error.problem.detail;
}

interface Props {
  month: string;
  target: BudgetTarget;
  onClose: () => void;
}

function savedMessage(target: BudgetTarget, amount: string) {
  const limit = formatTaka(amount);
  return target.categoryId === null
    ? `Overall budget set to ${limit}`
    : `Budget for ${target.name} set to ${limit}`;
}

export function BudgetEditSheet({ month, target, onClose }: Props) {
  const [text, setText] = useState(target.amount ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const save = useSetBudget();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isConfirmingRemove) cancelRef.current?.focus();
  }, [isConfirmingRemove]);

  async function restore(previousAmount: string) {
    try {
      await save.mutateAsync({ month, categoryId: target.categoryId, amount: previousAmount });
      toastSuccess(`Restored the ${target.name} budget`);
    } catch (e) {
      toastError(e);
    }
  }

  async function submit(amount: string | null) {
    try {
      await save.mutateAsync({ month, categoryId: target.categoryId, amount });
      const previousAmount = target.amount;
      if (amount !== null) toastSuccess(savedMessage(target, amount));
      else if (previousAmount)
        toastSuccess(`Removed the ${target.name} budget`, {
          undo: () => restore(previousAmount),
        });
      onClose();
    } catch (e) {
      setIsConfirmingRemove(false);
      const message = fieldMessage(e);
      if (message) setError(message);
      else toastError(e);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseTakaInput(text);
    if (amount === null || Number(amount) <= 0) {
      setError("Enter an amount in taka, like 5000 or 5000.50");
      return;
    }
    void submit(amount);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{target.name} budget</SheetTitle>
          <SheetDescription>Applies from {formatMonth(month)} onward.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="budget-amount">Monthly limit (৳)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={text}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "budget-amount-error" : undefined}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="budget-amount-error" role="alert" className="text-sm text-over">
                {error}
              </p>
            )}
          </div>
          {isConfirmingRemove ? (
            <div role="group" aria-label="Confirm removal" className="space-y-2">
              <p className="text-sm">
                Remove the {target.name} budget from {formatMonth(month)} onward?
              </p>
              <div className="flex justify-end gap-2">
                {/* Cancel takes focus so Enter never removes by accident. */}
                <Button
                  type="button"
                  variant="outline"
                  ref={cancelRef}
                  onClick={() => setIsConfirmingRemove(false)}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={save.isPending} onClick={() => void submit(null)}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-2">
              {target.amount ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => setIsConfirmingRemove(true)}
                >
                  Remove budget
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" className="h-11" disabled={save.isPending}>
                Save
              </Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
