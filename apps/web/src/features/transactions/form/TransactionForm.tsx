import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInDhaka } from "@/lib/dates";
import { parseTakaInput } from "@/lib/money";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { useCategories, usePaymentMethods, useTags } from "../hooks";
import type { Transaction } from "../TransactionRow";
import { CategoryChips } from "./CategoryChips";
import { DateQuickPick } from "./DateQuickPick";
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "./mutations";
import type { TransactionBody } from "./mutations";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { fieldForLoc, formSchema, poishaOf, type FormValues } from "./schema";
import { remainingPoisha, SplitEditor } from "./SplitEditor";
import { TagInput } from "./TagInput";

const LAST_METHOD_KEY = "kori.lastPaymentMethod";

function rememberedMethod(): string {
  try {
    return localStorage.getItem(LAST_METHOD_KEY) ?? "";
  } catch (e) {
    console.warn("Couldn't read the last payment method", e);
    return "";
  }
}

function remember(id: string) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, id);
  } catch (e) {
    // Storage can be blocked (private mode); saving must still work, so only warn.
    console.warn("Couldn't remember the payment method", e);
  }
}

interface Props {
  transaction?: Transaction;
  onDone: () => void;
}

export function TransactionForm({ transaction: edit, onDone }: Props) {
  const uid = useId();
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const knownTags = (useTags().data ?? []).map((t) => t.name);
  const create = useCreateTransaction();
  const update = useUpdateTransaction(edit?.id ?? "");
  const remove = useDeleteTransaction(edit?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string>();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: edit?.type ?? "expense",
      amount: edit?.amount ?? "",
      categoryId: edit?.lines[0]?.category.id ?? "",
      lines: edit?.is_split
        ? edit.lines.map((l) => ({ categoryId: l.category.id, amount: l.amount }))
        : [],
      occurredOn: edit?.occurred_on ?? todayInDhaka(),
      merchant: edit?.merchant ?? "",
      paymentMethodId: edit ? (edit.payment_method?.id ?? "") : rememberedMethod(),
      tags: edit?.tags ?? [],
      note: edit?.note ?? "",
    },
  });
  const { register, handleSubmit, control, setValue, setError, setFocus, formState } = form;
  const values = useWatch({ control }) as FormValues;
  const watch = <K extends keyof FormValues>(name: K) => values[name];
  const { errors, isSubmitting } = formState;
  const type = values.type;
  const split = values.lines.length > 0;
  const remaining = split ? remainingPoisha(values.amount, values.lines) : null;
  const unbalanced = split && remaining !== 0n;
  useEffect(() => {
    if (!edit?.is_split) setFocus("amount");
  }, [edit, setFocus]);
  const busy = isSubmitting || remove.isPending;
  const err = (name: keyof FormValues) => (errors[name] ? `${uid}-${name}-error` : undefined);
  const message = (name: keyof FormValues) =>
    errors[name] && (
      <p id={`${uid}-${name}-error`} className="text-sm text-red-600">
        {errors[name]?.message as string}
      </p>
    );

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    const amount = parseTakaInput(v.amount) ?? v.amount;
    const lines = v.lines.map((l) => ({
      category_id: l.categoryId,
      amount: parseTakaInput(l.amount) ?? l.amount,
    }));
    const body: TransactionBody = {
      type: v.type,
      amount,
      occurred_on: v.occurredOn,
      merchant: v.merchant.trim() || null,
      note: v.note.trim() || null,
      payment_method_id: v.paymentMethodId || null,
      tags: v.tags,
      ...(lines.length ? { lines } : { category_id: v.categoryId }),
    };
    const category = categories.find((c) => c.id === v.categoryId);
    const preview: Transaction = {
      id: edit?.id ?? `pending-${crypto.randomUUID()}`,
      source: edit?.source ?? "manual",
      created_at: edit?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_split: split,
      type: v.type,
      amount,
      occurred_on: v.occurredOn,
      merchant: body.merchant ?? null,
      note: body.note ?? null,
      payment_method: methods.find((m) => m.id === v.paymentMethodId) ?? null,
      tags: v.tags,
      lines: lines.length
        ? lines.flatMap((l) => {
            const c = categories.find((x) => x.id === l.category_id);
            return c ? [{ category: c, amount: l.amount, category_source: "user" as const }] : [];
          })
        : category
          ? [{ category, amount, category_source: "user" as const }]
          : [],
    };
    try {
      if (edit) await update.mutateAsync({ body, preview });
      else await create.mutateAsync({ body, preview });
      if (v.paymentMethodId) remember(v.paymentMethodId);
      onDone();
    } catch (e) {
      const errors =
        e instanceof ApiError && Array.isArray(e.problem.errors) ? e.problem.errors : [];
      let mapped = false;
      for (const item of errors as { loc?: unknown[]; msg?: string }[]) {
        const field = fieldForLoc(item.loc ?? []);
        if (field) {
          setError(field, { message: item.msg ?? "Invalid value" });
          mapped = true;
        }
      }
      if (!mapped) toastError(e);
      else setFormError("Please fix the highlighted fields.");
    }
  });

  const onDelete = async () => {
    if (!edit) return;
    try {
      await remove.mutateAsync({ body: {} as TransactionBody, preview: edit });
      onDone();
    } catch (e) {
      setConfirming(false);
      toastError(e);
    }
  };

  const kindCategories = categories.filter((c) => c.kind === type && !c.archived_at);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
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
            onClick={() => {
              const total = parseTakaInput(values.amount) ?? values.amount;
              setValue("lines", [
                { categoryId: values.categoryId, amount: poishaOf(values.amount) ? total : "" },
                { categoryId: "", amount: "" },
              ]);
            }}
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
          known={knownTags}
        />
        {message("tags")}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${uid}-note`}>Note</Label>
        <Input id={`${uid}-note`} aria-describedby={err("note")} {...register("note")} />
        {message("note")}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-2">
        {edit && !confirming && (
          <Button
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
          className="space-y-2 rounded-md border border-red-600 p-3"
        >
          <p className="text-sm">Delete this transaction? This can't be undone.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              Confirm delete
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
