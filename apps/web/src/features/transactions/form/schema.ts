import type { Path } from "react-hook-form";
import { z } from "zod";

import { parseTakaInput, toPoisha } from "@/lib/money";

export const MAX_LINES = 20;

const lineSchema = z.object({ categoryId: z.string(), amount: z.string() });

const baseSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z
    .string()
    .refine((v) => parseTakaInput(v) !== null, "Enter an amount like 1,250.50")
    .refine((v) => parseTakaInput(v) !== "0" && parseTakaInput(v) !== "0.00", "Must be above zero"),
  categoryId: z.string(),
  lines: z.array(lineSchema).max(MAX_LINES),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  merchant: z.string().max(120, "At most 120 characters"),
  paymentMethodId: z.string(),
  tags: z.array(z.string()),
  note: z.string().max(500, "At most 500 characters"),
});

/** Poisha for a typed amount, or null when it isn't a valid amount. */
export function poishaOf(input: string): bigint | null {
  const parsed = parseTakaInput(input);
  return parsed === null ? null : toPoisha(parsed);
}

export const formSchema = baseSchema.superRefine((v, ctx) => {
  if (v.lines.length === 0) {
    if (!v.categoryId)
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category" });
    return;
  }
  if (v.lines.length < 2) {
    ctx.addIssue({ code: "custom", path: ["lines"], message: "A split needs at least 2 lines" });
  }
  let sum = 0n;
  v.lines.forEach((line, i) => {
    if (!line.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["lines", i, "categoryId"],
        message: "Pick a category",
      });
    }
    const poisha = poishaOf(line.amount);
    if (poisha === null) {
      ctx.addIssue({
        code: "custom",
        path: ["lines", i, "amount"],
        message: "Enter an amount like 1,250.50",
      });
    } else if (poisha <= 0n) {
      ctx.addIssue({ code: "custom", path: ["lines", i, "amount"], message: "Must be above zero" });
    } else {
      sum += poisha;
    }
  });
  const total = poishaOf(v.amount);
  if (total !== null && sum !== total) {
    ctx.addIssue({ code: "custom", path: ["lines"], message: "Lines must add up to the total" });
  }
});

export type FormValues = z.infer<typeof formSchema>;

/**
 * Maps an API `errors[].loc` (["body", "lines", 0, "category_id"]) to a form field path
 * ("lines.0.categoryId"), so a server error lands under the right line.
 */
export function fieldForLoc(loc: unknown[]): Path<FormValues> | undefined {
  const names: Record<string, Path<FormValues>> = {
    amount: "amount",
    category_id: "categoryId",
    occurred_on: "occurredOn",
    merchant: "merchant",
    payment_method_id: "paymentMethodId",
    tags: "tags",
    note: "note",
    type: "type",
  };
  const at = loc.indexOf("lines");
  const index = at >= 0 ? loc[at + 1] : undefined;
  const leaf = loc.filter((p) => typeof p === "string").at(-1);
  if (typeof index === "number" && (leaf === "amount" || leaf === "category_id")) {
    return `lines.${index}.${leaf === "amount" ? "amount" : "categoryId"}` as Path<FormValues>;
  }
  return typeof leaf === "string" ? names[leaf] : undefined;
}
