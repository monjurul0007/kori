import { zodResolver } from "@hookform/resolvers/zod";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInDhaka } from "@/lib/dates";
import { formatTaka, parseTakaInput } from "@/lib/money";
import { problemFieldErrors } from "@/lib/problem";
import { toastError } from "@/lib/toast";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { OFFLINE_MESSAGE } from "@/pwa/useOnline";

import { useCategories, usePaymentMethods, useTags } from "../hooks";
import type { Transaction } from "../TransactionRow";
import { CategoryGrid } from "./CategoryGrid";
import { DeleteButton, DeleteConfirm } from "./DeleteControls";
import { rememberedMethod, rememberMethod } from "./lastPaymentMethod";
import { OptionalFields } from "./OptionalFields";
import { fieldForLoc, formSchema, initialSplitLines, type FormValues } from "./schema";
import { remainingPoisha, SplitEditor } from "./SplitEditor";
import { buildSubmission, type Submission } from "./submission";
import { TagInput } from "./TagInput";
import type { DeleteFlow } from "./useDeleteFlow";
import { useRankedCategories } from "./useRankedCategories";

const DESKTOP_QUERY = "(min-width: 768px)";
const TYPE_LABELS = { expense: "Expense", income: "Income" } as const;
const TRANSACTION_TYPES = ["expense", "income"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Starting date for a new entry; defaults to today (Dhaka). */
  defaultDate?: string;
  /** The row being edited. Absent for a new entry. */
  transaction?: Transaction;
  /** Creates or updates; throws when the request fails so the sheet can show why. */
  onSave: (submission: Submission) => Promise<void>;
  /** Present when the row can be deleted, i.e. in edit mode. */
  deletion?: DeleteFlow;
}

function initialValues(transaction: Transaction | undefined, defaultDate: string | undefined) {
  if (!transaction) {
    return {
      type: "expense",
      amount: "",
      categoryId: "",
      lines: [],
      occurredOn: defaultDate ?? todayInDhaka(),
      merchant: "",
      paymentMethodId: rememberedMethod(),
      tags: [],
      note: "",
    } satisfies FormValues;
  }
  return {
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.lines[0]?.category.id ?? "",
    lines: transaction.is_split
      ? transaction.lines.map((l) => ({ categoryId: l.category.id, amount: l.amount }))
      : [],
    occurredOn: transaction.occurred_on,
    merchant: transaction.merchant ?? "",
    paymentMethodId: transaction.payment_method?.id ?? "",
    tags: transaction.tags,
    note: transaction.note ?? "",
  } satisfies FormValues;
}

/** The quick-entry sheet, for adding a transaction and for editing one: amount, category, Save. */
export function QuickEntrySheet({ open, ...rest }: Props) {
  // Mounting only while open gives every entry a fresh form and a fresh discard guard.
  return open ? <QuickEntry open {...rest} /> : null;
}

function QuickEntry({ open, onOpenChange, defaultDate, transaction, onSave, deletion }: Props) {
  const uid = useId();
  const formId = `${uid}-form`;
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const knownTags = (useTags().data ?? []).map((t) => t.name);
  const [formError, setFormError] = useState<string>();
  const [pendingTag, setPendingTag] = useState("");
  const isEditing = transaction !== undefined;
  const [isShowingExtras, setIsShowingExtras] = useState(
    isEditing && (transaction.tags.length > 0 || !!transaction.note),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(transaction, defaultDate),
  });
  const { register, handleSubmit, control, setValue, setError, formState } = form;
  const values = useWatch({ control }) as FormValues;
  const { errors, isSubmitting, isDirty } = formState;
  const type = values.type;
  const isSplit = values.lines.length > 0;
  const isUnbalanced = isSplit && remainingPoisha(values.amount, values.lines) !== 0n;
  const kindCategories = useRankedCategories(
    categories.filter((c) => c.kind === type && !c.archived_at),
  );

  const errorId = (name: keyof FormValues) => (errors[name] ? `${uid}-${name}-error` : undefined);
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
    const submission = buildSubmission(v, {
      categories,
      methods,
      pendingTag,
      existing: transaction,
    });
    try {
      await onSave(submission);
      if (v.paymentMethodId) rememberMethod(v.paymentMethodId);
      onOpenChange(false);
    } catch (e) {
      const problems = problemFieldErrors(e, fieldForLoc);
      for (const { field, message } of problems) setError(field, { message });
      if (problems.length === 0) toastError(e);
      else setFormError("Please fix the highlighted fields.");
    }
  });

  const amount = parseTakaInput(values.amount);
  const saveLabel = isEditing
    ? "Save changes"
    : `Save ${amount ? `${formatTaka(amount)} ` : ""}${type}`;
  const title = `${isEditing ? "Edit" : "New"} ${type}`;
  const isDeleting = deletion?.isPending ?? false;
  const isConfirmingDelete = deletion?.isConfirming ?? false;
  const shownError = formError ?? deletion?.error;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={isEditing ? "Change or delete this transaction." : "Log a new transaction."}
      dirty={isDirty || pendingTag.trim() !== ""}
      onEscapeKeyDown={(event) => {
        // Esc backs out of "Delete this transaction?" without closing the sheet, and does
        // nothing while the request is in flight, like the disabled buttons.
        if (!deletion?.isConfirming) return;
        event.preventDefault();
        if (!deletion.isPending) deletion.cancel();
      }}
      footer={
        <>
          {deletion && isDesktop && !isConfirmingDelete && (
            <DeleteButton
              buttonRef={deletion.deleteButtonRef}
              isPending={isDeleting}
              onClick={deletion.askToConfirm}
              className="mr-auto"
            />
          )}
          <DialogPrimitive.Close asChild>
            <Button type="button" variant="outline" className="hidden md:inline-flex">
              Cancel
            </Button>
          </DialogPrimitive.Close>
          <Button
            type="submit"
            form={formId}
            className="h-12 flex-1"
            disabled={isSubmitting || isDeleting || isUnbalanced}
          >
            {isSubmitting ? "Saving…" : saveLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <div
          role="group"
          aria-label="Type"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              disabled={isSplit}
              onClick={() => {
                setValue("type", t);
                setValue("categoryId", "");
              }}
              className={cn(
                "min-h-9 rounded-md text-sm font-medium",
                type === t ? "bg-surface shadow" : "text-muted-foreground",
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-2 border-b-2 border-primary pb-1">
            <span aria-hidden="true" className="font-display text-2xl text-muted-foreground">
              ৳
            </span>
            <Input
              aria-label="Amount (৳)"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- a sheet opened to log an amount
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              aria-invalid={!!errors.amount}
              aria-describedby={errorId("amount")}
              className="h-auto border-0 bg-transparent p-0 font-display text-4xl font-bold shadow-none focus-visible:ring-0 md:text-4xl"
              {...register("amount")}
            />
          </div>
          {message("amount")}
        </div>

        {isSplit ? (
          <SplitEditor
            form={form}
            categories={kindCategories}
            onCollapse={(id) => {
              setValue("lines", []);
              setValue("categoryId", id, { shouldValidate: true });
            }}
          />
        ) : (
          <div className="space-y-2">
            <Label>Category</Label>
            <CategoryGrid
              categories={kindCategories}
              value={values.categoryId}
              onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
              describedBy={errorId("categoryId")}
            />
            {message("categoryId")}
          </div>
        )}

        <OptionalFields
          idPrefix={uid}
          isDesktop={isDesktop}
          date={values.occurredOn}
          onDateChange={(d) => setValue("occurredOn", d, { shouldValidate: true })}
          methods={methods}
          methodId={values.paymentMethodId}
          onMethodChange={(id) => setValue("paymentMethodId", id)}
          merchant={register("merchant")}
          merchantText={values.merchant}
          dateErrorId={errorId("occurredOn")}
          errors={{ date: message("occurredOn"), merchant: message("merchant") }}
        />

        <button
          type="button"
          aria-expanded={isShowingExtras}
          onClick={() => setIsShowingExtras((shown) => !shown)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tags, note or split
        </button>
        {isShowingExtras && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor={`${uid}-tags`}>Tags</Label>
              <TagInput
                id={`${uid}-tags`}
                value={values.tags}
                onChange={(t) => setValue("tags", t)}
                onPendingChange={setPendingTag}
                known={knownTags}
              />
              {message("tags")}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-note`}>Note</Label>
              <Input id={`${uid}-note`} aria-describedby={errorId("note")} {...register("note")} />
              {message("note")}
            </div>
            {!isSplit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setValue("lines", initialSplitLines(values))}
              >
                Split
              </Button>
            )}
          </div>
        )}

        {transaction?.recurring_rule_id && (
          <p className="text-sm text-muted-foreground">
            Added automatically. Changes here apply to this occurrence only.{" "}
            <Link
              to={`/settings/recurring?rule=${transaction.recurring_rule_id}`}
              onClick={() => onOpenChange(false)}
              className="font-medium text-foreground underline"
            >
              Edit rule
            </Link>
          </p>
        )}

        {shownError && (
          <p role="alert" className="text-sm text-over">
            {shownError}
          </p>
        )}
      </form>
      {deletion && !isDesktop && !isConfirmingDelete && (
        <DeleteButton
          buttonRef={deletion.deleteButtonRef}
          isPending={isDeleting}
          onClick={deletion.askToConfirm}
          className="mt-5 w-full"
        />
      )}
      {deletion && isConfirmingDelete && (
        <div className="mt-5">
          <DeleteConfirm flow={deletion} />
        </div>
      )}
    </FormSheet>
  );
}
