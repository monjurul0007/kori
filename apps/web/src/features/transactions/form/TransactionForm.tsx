import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTaka } from "@/lib/money";
import { problemFieldErrors } from "@/lib/problem";
import { OFFLINE_MESSAGE } from "@/pwa/useOnline";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { useCategories, usePaymentMethods, useTags } from "../hooks";
import type { Transaction } from "../TransactionRow";
import { CategoryChips } from "./CategoryChips";
import { DateQuickPick } from "./DateQuickPick";
import { useDeleteTransaction, useUpdateTransaction } from "./mutations";
import type { TransactionBody } from "./mutations";
import { rememberMethod } from "./lastPaymentMethod";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { fieldForLoc, formSchema, initialSplitLines, type FormValues } from "./schema";
import { remainingPoisha, SplitEditor } from "./SplitEditor";
import { buildSubmission } from "./submission";
import { TagInput } from "./TagInput";

interface Props {
  transaction: Transaction;
  onDone: () => void;
  /** Reports whether anything has been typed, so the sheet can guard closing. */
  onDirtyChange?: (dirty: boolean) => void;
  /** The delete confirmation is owned by the sheet so that Esc can cancel just that step. */
  confirmingDelete: boolean;
  onConfirmingDeleteChange: (confirming: boolean) => void;
  /** Lets the sheet ignore Esc while a delete request is in flight. */
  onDeletePendingChange: (pending: boolean) => void;
}

export function TransactionForm({
  transaction: edit,
  onDone,
  onDirtyChange,
  confirmingDelete: confirming,
  onConfirmingDeleteChange: setConfirming,
  onDeletePendingChange,
}: Props) {
  const uid = useId();
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const knownTags = (useTags().data ?? []).map((t) => t.name);
  const update = useUpdateTransaction(edit.id);
  const remove = useDeleteTransaction(edit.id);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const [formError, setFormError] = useState<string>();
  const [pendingTag, setPendingTag] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: edit.type,
      amount: edit.amount,
      categoryId: edit.lines[0]?.category.id ?? "",
      lines: edit.is_split
        ? edit.lines.map((l) => ({ categoryId: l.category.id, amount: l.amount }))
        : [],
      occurredOn: edit.occurred_on,
      merchant: edit.merchant ?? "",
      paymentMethodId: edit.payment_method?.id ?? "",
      tags: edit.tags,
      note: edit.note ?? "",
    },
  });
  const { register, handleSubmit, control, setValue, setError, setFocus, formState } = form;
  const values = useWatch({ control }) as FormValues;
  const watch = <K extends keyof FormValues>(name: K) => values[name];
  const { errors, isSubmitting, isDirty } = formState;
  const hasInput = isDirty || pendingTag.trim() !== "";
  useEffect(() => {
    onDirtyChange?.(hasInput);
  }, [hasInput, onDirtyChange]);
  const type = values.type;
  const split = values.lines.length > 0;
  const remaining = split ? remainingPoisha(values.amount, values.lines) : null;
  const unbalanced = split && remaining !== 0n;
  useEffect(() => {
    if (!edit.is_split) setFocus("amount");
  }, [edit, setFocus]);
  const busy = isSubmitting || remove.isPending;
  useEffect(() => {
    onDeletePendingChange(remove.isPending);
  }, [remove.isPending, onDeletePendingChange]);
  useEffect(() => {
    // Keep keyboard users in place: Cancel is the safe choice, and Delete gets focus back.
    if (confirming) cancelRef.current?.focus();
    else if (wasConfirming.current) deleteRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  const err = (name: keyof FormValues) => (errors[name] ? `${uid}-${name}-error` : undefined);
  const message = (name: keyof FormValues) =>
    errors[name] && (
      <p id={`${uid}-${name}-error`} className="text-sm text-over">
        {errors[name]?.message as string}
      </p>
    );

  const submit = handleSubmit(async (v) => {
    if (!navigator.onLine) {
      // Fail fast and keep what was typed; nothing is reset.
      setFormError(OFFLINE_MESSAGE);
      return;
    }
    setFormError(undefined);
    const { body, preview } = buildSubmission(v, {
      categories,
      methods,
      pendingTag,
      existing: edit,
    });
    try {
      await update.mutateAsync({ body, preview });
      toastSuccess("Saved changes");
      if (v.paymentMethodId) rememberMethod(v.paymentMethodId);
      onDone();
    } catch (e) {
      const problems = problemFieldErrors(e, fieldForLoc);
      for (const { field, message } of problems) setError(field, { message });
      const mapped = problems.length > 0;
      if (!mapped) toastError(e);
      else setFormError("Please fix the highlighted fields.");
    }
  });

  const onDelete = async () => {
    if (!navigator.onLine) {
      setConfirming(false);
      setFormError(OFFLINE_MESSAGE);
      return;
    }
    try {
      await remove.mutateAsync({ body: {} as TransactionBody, preview: edit });
      const what = edit.merchant || edit.note;
      // No Undo: re-creating the row would give it a new id and could drop AI source markers.
      toastSuccess(`Deleted ${formatTaka(edit.amount)}${what ? ` · ${what}` : ""}`);
      onDone();
    } catch (e) {
      setConfirming(false);
      toastError(e);
    }
  };

  const kindCategories = categories.filter((c) => c.kind === type && !c.archived_at);

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
      <div data-testid="form-body" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-amount`}>Amount (৳)</Label>
          <Input
            id={`${uid}-amount`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-invalid={!!errors.amount}
            aria-describedby={err("amount")}
            className="h-14 text-3xl font-semibold md:text-3xl"
            {...register("amount")}
          />
          {message("amount")}
        </div>

        <div
          role="group"
          aria-label="Type"
          className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
        >
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => {
                setValue("type", t);
                setValue("categoryId", "");
              }}
              disabled={split}
              className={cn(
                "min-h-9 rounded text-sm font-medium",
                type === t ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        {split ? (
          <SplitEditor
            form={form}
            categories={kindCategories}
            onCollapse={(id) => {
              setValue("lines", []);
              setValue("categoryId", id, { shouldValidate: true });
            }}
          />
        ) : (
          <div className="space-y-1">
            <Label>Category</Label>
            <CategoryChips
              categories={kindCategories}
              value={watch("categoryId")}
              onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
              describedBy={err("categoryId")}
            />
            {message("categoryId")}
            <Button
              type="button"
              variant="outline"
              onClick={() => setValue("lines", initialSplitLines(values))}
            >
              Split
            </Button>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor={`${uid}-date`}>Date</Label>
          <DateQuickPick
            id={`${uid}-date`}
            value={watch("occurredOn")}
            onChange={(d) => setValue("occurredOn", d, { shouldValidate: true })}
            describedBy={err("occurredOn")}
          />
          {message("occurredOn")}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${uid}-merchant`}>Merchant</Label>
          <Input
            id={`${uid}-merchant`}
            aria-describedby={err("merchant")}
            {...register("merchant")}
          />
          {message("merchant")}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${uid}-method`}>Payment method</Label>
          <PaymentMethodSelect
            id={`${uid}-method`}
            methods={methods}
            value={watch("paymentMethodId")}
            onChange={(id) => setValue("paymentMethodId", id)}
          />
          {message("paymentMethodId")}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${uid}-tags`}>Tags</Label>
          <TagInput
            id={`${uid}-tags`}
            value={watch("tags")}
            onChange={(t) => setValue("tags", t)}
            onPendingChange={setPendingTag}
            known={knownTags}
          />
          {message("tags")}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${uid}-note`}>Note</Label>
          <Input id={`${uid}-note`} aria-describedby={err("note")} {...register("note")} />
          {message("note")}
        </div>

        {edit.recurring_rule_id && (
          <p className="text-sm text-muted-foreground">
            Added automatically. Changes here apply to this occurrence only.{" "}
            <Link
              to={`/settings/recurring?rule=${edit.recurring_rule_id}`}
              onClick={onDone}
              className="font-medium text-foreground underline"
            >
              Edit rule
            </Link>
          </p>
        )}

        {formError && (
          <p role="alert" className="text-sm text-over">
            {formError}
          </p>
        )}
      </div>

      <div data-testid="form-footer" className="space-y-3 border-t bg-background pt-3">
        <div className="flex items-center gap-2">
          {!confirming && (
            <Button
              ref={deleteRef}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={busy || unbalanced}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>

        {confirming && (
          <div
            role="alertdialog"
            aria-label="Confirm delete"
            aria-busy={remove.isPending}
            className="space-y-2 rounded-md border border-over p-3"
          >
            <p className="text-sm">Delete this transaction? This can't be undone.</p>
            <div className="flex gap-2">
              <Button
                ref={cancelRef}
                type="button"
                variant="outline"
                disabled={remove.isPending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-over text-primary-foreground hover:bg-over/90"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                {remove.isPending ? "Deleting…" : "Confirm delete"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
