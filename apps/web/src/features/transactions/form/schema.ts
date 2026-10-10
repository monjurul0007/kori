import { z } from "zod";

import { parseTakaInput } from "@/lib/money";

export const formSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z
    .string()
    .refine((v) => parseTakaInput(v) !== null, "Enter an amount like 1,250.50")
    .refine((v) => parseTakaInput(v) !== "0" && parseTakaInput(v) !== "0.00", "Must be above zero"),
  categoryId: z.string().min(1, "Pick a category"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  merchant: z.string().max(120, "At most 120 characters"),
  paymentMethodId: z.string(),
  tags: z.array(z.string()),
  note: z.string().max(500, "At most 500 characters"),
});

export type FormValues = z.infer<typeof formSchema>;

/** Maps an API `errors[].loc` (["body", "lines", 0, "category_id"]) to a form field. */
export function fieldForLoc(loc: unknown[]): keyof FormValues | undefined {
  const names: Record<string, keyof FormValues> = {
    amount: "amount",
    category_id: "categoryId",
    occurred_on: "occurredOn",
    merchant: "merchant",
    payment_method_id: "paymentMethodId",
    tags: "tags",
    note: "note",
    type: "type",
  };
  const leaf = loc.filter((p) => typeof p === "string").at(-1);
  return typeof leaf === "string" ? names[leaf] : undefined;
}
