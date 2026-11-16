import { useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTaka, fromPoisha } from "@/lib/money";

import { MAX_LINES, poishaOf, type FormValues } from "./schema";

interface Category {
  id: string;
  name: string;
}

interface Props {
  form: UseFormReturn<FormValues>;
  categories: Category[];
  /** Called when removing a line leaves one, so the form can go back to a single category. */
  onCollapse: (categoryId: string) => void;
}

/** Total minus the lines, in poisha; null while the total isn't a valid amount. */
export function remainingPoisha(total: string, lines: { amount: string }[]): bigint | null {
  const whole = poishaOf(total);
  if (whole === null) return null;
  const sum = lines.reduce((acc, l) => acc + (poishaOf(l.amount) ?? 0n), 0n);
  return whole - sum;
}

export function SplitEditor({ form, categories, onCollapse }: Props) {
  const { control, register, setValue, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const total = useWatch({ control, name: "amount" });
  const [focused, setFocused] = useState<number>();
  const remaining = remainingPoisha(total, lines);
  const lineErrors = formState.errors.lines;
  const rootError =
    (lineErrors as { root?: { message?: string }; message?: string } | undefined)?.root?.message ??
    (lineErrors as { message?: string } | undefined)?.message;

  const fillRemaining = () => {
    if (remaining === null) return;
    // The line you last tapped, if it's still empty; otherwise the last line.
    const last = lines.length - 1;
    const i = focused !== undefined && focused <= last && !lines[focused]?.amount ? focused : last;
    const current = poishaOf(lines[i]?.amount ?? "") ?? 0n;
    const next = current + remaining;
    if (next > 0n) setValue(`lines.${i}.amount`, fromPoisha(next), { shouldValidate: true });
  };

  const removeLine = (i: number) => {
    if (fields.length <= 2) {
      const keep = lines[i === 0 ? 1 : 0]?.categoryId ?? "";
      remove();
      onCollapse(keep);
    } else {
      remove(i);
    }
  };

  let status = "";
  if (remaining !== null) {
    status =
      remaining === 0n
        ? "Remaining ৳0"
        : remaining > 0n
          ? `Remaining ${formatTaka(fromPoisha(remaining))}`
          : `Over by ${formatTaka(fromPoisha(-remaining))}`;
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <ul className="space-y-3">
        {fields.map((field, i) => {
          const n = i + 1;
          const amountError = lineErrors?.[i]?.amount?.message;
          const categoryError = lineErrors?.[i]?.categoryId?.message;
          return (
            <li key={field.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Line ${n} category`}
                  aria-invalid={!!categoryError}
                  className="h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                  {...register(`lines.${i}.categoryId`)}
                >
                  <option value="">Category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Line ${n} amount`}
                  aria-invalid={!!amountError}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="w-28 text-right"
                  {...register(`lines.${i}.amount`)}
                  onFocus={() => setFocused(i)}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Remove line ${n}`}
                  onClick={() => removeLine(i)}
                >
                  ✕
                </Button>
              </div>
              {(categoryError ?? amountError) && (
                <p className="text-sm text-red-600">{categoryError ?? amountError}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= MAX_LINES}
          onClick={() => append({ categoryId: "", amount: "" })}
        >
          Add line
        </Button>
        <Button type="button" variant="outline" onClick={fillRemaining}>
          Fill remaining
        </Button>
        <p
          aria-live="polite"
          className={`ml-auto text-sm font-medium ${remaining !== null && remaining < 0n ? "text-red-600" : ""}`}
        >
          {status}
        </p>
      </div>
      {rootError && <p className="text-sm text-red-600">{rootError}</p>}
    </div>
  );
}
