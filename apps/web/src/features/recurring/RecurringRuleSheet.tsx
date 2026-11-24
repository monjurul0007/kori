import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

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
import { formatDisplayDate, todayInDhaka } from "@/lib/dates";
import { parseTakaInput } from "@/lib/money";
import { toastError } from "@/lib/toast";
import { CategoryChips } from "@/features/transactions/form/CategoryChips";
import { PaymentMethodSelect } from "@/features/transactions/form/PaymentMethodSelect";
import { useCategories, usePaymentMethods } from "@/features/transactions/hooks";

import { useCreateRule, useUpdateRule, type Rule } from "./hooks";
import { fieldForLoc, ruleFormSchema, type RuleFormValues } from "./schema";
import { formatSchedule } from "./schedule";

const SELECT =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

interface Props {
  /** Present to edit, absent to create. */
  rule?: Rule;
  onClose: () => void;
}

export function RecurringRuleSheet({ rule, onClose }: Props) {
  const uid = useId();
  const categories = useCategories().data ?? [];
  const methods = usePaymentMethods().data ?? [];
  const create = useCreateRule();
  const update = useUpdateRule(rule?.id ?? "");
  // After saving, show the next dates from the API before closing.
  const [saved, setSaved] = useState<Rule>();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: rule?.name ?? "",
      type: rule?.type ?? "expense",
      amount: rule?.amount ?? "",
      categoryId: rule?.category.id ?? "",
      paymentMethodId: rule?.payment_method?.id ?? "",
      merchant: rule?.merchant ?? "",
      note: rule?.note ?? "",
      frequency: rule?.frequency ?? "monthly",
      interval: rule?.interval ?? 1,
      startOn: rule?.start_on ?? todayInDhaka(),
      endOn: rule?.end_on ?? "",
    },
  });
  const { register, handleSubmit, control, setValue, setError, formState } = form;
  const values = useWatch({ control }) as RuleFormValues;
  const { errors, isSubmitting } = formState;
  const editing = !!rule;

  const err = (name: keyof RuleFormValues) => (errors[name] ? `${uid}-${name}-error` : undefined);
  const message = (name: keyof RuleFormValues) =>
    errors[name] && (
      <p id={`${uid}-${name}-error`} role="alert" className="text-sm text-over">
        {errors[name]?.message as string}
      </p>
    );

  const submit = handleSubmit(async (v) => {
    const common = {
      name: v.name.trim(),
      amount: parseTakaInput(v.amount) ?? v.amount,
      category_id: v.categoryId,
      payment_method_id: v.paymentMethodId || null,
      merchant: v.merchant.trim() || null,
      note: v.note.trim() || null,
      frequency: v.frequency,
      interval: v.interval,
      start_on: v.startOn,
      end_on: v.endOn || null,
    };
    try {
      const result = rule
        ? await update.mutateAsync(common)
        : await create.mutateAsync({ ...common, type: v.type });
      setSaved(result);
    } catch (e) {
      const items =
        e instanceof ApiError && e.response.status === 422 && Array.isArray(e.problem.errors)
          ? (e.problem.errors as { loc?: unknown[]; msg?: string }[])
          : [];
      let mapped = false;
      for (const item of items) {
        const field = fieldForLoc(item.loc ?? []);
        if (field) {
          setError(field, { message: item.msg ?? "Invalid value" });
          mapped = true;
        }
      }
      if (!mapped) toastError(e);
    }
  });

  const summary = formatSchedule({
    frequency: values.frequency,
    interval: Number(values.interval) || 1,
    start_on: values.startOn,
  });
  const kindCategories = categories.filter((c) => c.kind === values.type && !c.archived_at);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{saved ? "Saved" : editing ? "Edit rule" : "New recurring rule"}</SheetTitle>
          <SheetDescription>
            {saved
              ? "Added automatically on these dates."
              : "Transactions are added automatically on each due date."}
          </SheetDescription>
        </SheetHeader>
        {saved ? (
          <div className="mt-4 space-y-4">
            <p className="font-medium">{formatSchedule(saved)}</p>
            <ul aria-label="Next dates" className="space-y-1 text-sm">
              {saved.upcoming.slice(0, 3).map((d) => (
                <li key={d}>{formatDisplayDate(d)}</li>
              ))}
            </ul>
            <Button className="h-11" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label htmlFor={`${uid}-name`}>Name</Label>
              <Input
                id={`${uid}-name`}
                placeholder="Rent"
                aria-invalid={!!errors.name}
                aria-describedby={err("name")}
                {...register("name")}
              />
              {message("name")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${uid}-type`}>Type</Label>
                <select
                  id={`${uid}-type`}
                  className={SELECT}
                  disabled={editing}
                  {...register("type", { onChange: () => setValue("categoryId", "") })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${uid}-amount`}>Amount (৳)</Label>
                <Input
                  id={`${uid}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={!!errors.amount}
                  aria-describedby={err("amount")}
                  {...register("amount")}
                />
                {message("amount")}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <CategoryChips
                categories={kindCategories}
                value={values.categoryId}
                onChange={(id) =>
                  setValue("categoryId", id, { shouldValidate: formState.isSubmitted })
                }
                describedBy={err("categoryId")}
              />
              {message("categoryId")}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-method`}>Payment method</Label>
              <PaymentMethodSelect
                id={`${uid}-method`}
                methods={methods}
                value={values.paymentMethodId}
                onChange={(id) => setValue("paymentMethodId", id)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-merchant`}>Merchant</Label>
              <Input id={`${uid}-merchant`} {...register("merchant")} />
              {message("merchant")}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-note`}>Note</Label>
              <Input id={`${uid}-note`} {...register("note")} />
              {message("note")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${uid}-frequency`}>Repeats</Label>
                <select id={`${uid}-frequency`} className={SELECT} {...register("frequency")}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${uid}-interval`}>Every</Label>
                <Input
                  id={`${uid}-interval`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-invalid={!!errors.interval}
                  aria-describedby={err("interval")}
                  {...register("interval", { valueAsNumber: true })}
                />
                {message("interval")}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${uid}-start`}>Start date</Label>
                <Input
                  id={`${uid}-start`}
                  type="date"
                  aria-invalid={!!errors.startOn}
                  aria-describedby={err("startOn")}
                  {...register("startOn")}
                />
                {message("startOn")}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${uid}-end`}>End date (optional)</Label>
                <Input
                  id={`${uid}-end`}
                  type="date"
                  aria-invalid={!!errors.endOn}
                  aria-describedby={err("endOn")}
                  {...register("endOn")}
                />
                {message("endOn")}
              </div>
            </div>
            {summary && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {summary}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
              Save
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
