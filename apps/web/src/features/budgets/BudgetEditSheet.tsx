import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { formatMonth } from "@/lib/dates";
import {
  AMOUNT_ERRORS,
  formatTaka,
  parseTakaInput,
  stripValueErrorPrefix,
  validateAmount,
} from "@/lib/money";
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
  const message = first?.msg ?? error.problem.detail;
  return message ? stripValueErrorPrefix(message) : null;
}

export interface CategoryChoice {
  id: string;
  name: string;
}

interface Props {
  month: string;
  target: BudgetTarget;
  /** "Add a category budget": the person picks which category the limit is for. */
  choices?: CategoryChoice[];
  onClose: () => void;
}

const CATEGORY_REQUIRED = "Choose a category";

function savedMessage(target: BudgetTarget, amount: string) {
  const limit = formatTaka(amount);
  return target.categoryId === null
    ? `Overall budget set to ${limit}`
    : `Budget for ${target.name} set to ${limit}`;
}

const FORM_ID = "budget-form";
const NO_CHOICE = "";

export function BudgetEditSheet({ month, target: given, choices, onClose }: Props) {
  const [pickedId, setPickedId] = useState(NO_CHOICE);
  const picked = choices?.find((choice) => choice.id === pickedId);
  const isPicking = choices !== undefined;
  const target: BudgetTarget = isPicking
    ? { categoryId: picked?.id ?? null, name: picked?.name ?? "Category" }
    : given;
  const [text, setText] = useState(given.amount ?? "");
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
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
    if (isPicking && !picked) {
      setCategoryError(CATEGORY_REQUIRED);
      return;
    }
    const message = validateAmount(text);
    const amount = parseTakaInput(text);
    if (message || amount === null) {
      setError(message ?? AMOUNT_ERRORS.missing);
      return;
    }
    void submit(amount);
  }

  const canRemove = Boolean(target.amount);
  return (
    <FormSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${target.name} budget`}
      description="Set the monthly spending limit."
      dirty={text !== (given.amount ?? "") || pickedId !== NO_CHOICE}
      onEscapeKeyDown={(event) => {
        // Esc backs out of "Remove the budget?" without closing the sheet.
        if (!isConfirmingRemove) return;
        event.preventDefault();
        setIsConfirmingRemove(false);
      }}
      footer={
        isConfirmingRemove ? (
          <>
            {/* Cancel takes focus so Enter never removes by accident. */}
            <Button
              type="button"
              variant="outline"
              ref={cancelRef}
              onClick={() => setIsConfirmingRemove(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 flex-1"
              disabled={save.isPending}
              onClick={() => void submit(null)}
            >
              Remove
            </Button>
          </>
        ) : (
          <>
            {canRemove && (
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => setIsConfirmingRemove(true)}
              >
                Remove budget
              </Button>
            )}
            <Button type="submit" form={FORM_ID} className="h-12 flex-1" disabled={save.isPending}>
              Save
            </Button>
          </>
        )
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-4">
        {isPicking && (
          <Field label="Category" error={categoryError ?? undefined}>
            {(control) => (
              <select
                {...control}
                value={pickedId}
                onChange={(e) => {
                  setPickedId(e.target.value);
                  setCategoryError(null);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"
              >
                <option value={NO_CHOICE}>Choose a category</option>
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field
          label="Monthly limit (৳)"
          hint={`Applies from ${formatMonth(month)} onward.`}
          error={error ?? undefined}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        {isConfirmingRemove && (
          <p role="group" aria-label="Confirm removal" className="text-sm">
            Remove the {target.name} budget from {formatMonth(month)} onward?
          </p>
        )}
      </form>
    </FormSheet>
  );
}
