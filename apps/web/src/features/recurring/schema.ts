import { z } from "zod";

import { parseTakaInput } from "@/lib/money";

const date = /^\d{4}-\d{2}-\d{2}$/;

export const ruleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the rule a name").max(80, "At most 80 characters"),
    type: z.enum(["expense", "income"]),
    amount: z
      .string()
      .refine((v) => parseTakaInput(v) !== null, "Enter an amount like 1,250.50")
      .refine((v) => Number(parseTakaInput(v) ?? 1) > 0, "Must be above zero"),
    categoryId: z.string().min(1, "Pick a category"),
    paymentMethodId: z.string(),
    merchant: z.string().max(120, "At most 120 characters"),
    note: z.string().max(500, "At most 500 characters"),
    frequency: z.enum(["weekly", "monthly", "yearly"]),
    interval: z
      .number({ error: "Enter a whole number" })
      .int("Enter a whole number")
      .min(1, "At least 1")
      .max(99, "At most 99"),
    startOn: z.string().regex(date, "Pick a start date"),
    endOn: z.string().refine((v) => v === "" || date.test(v), "Pick an end date"),
  })
  .refine((v) => v.endOn === "" || v.endOn >= v.startOn, {
    path: ["endOn"],
    message: "End date must be on or after the start",
  });

export type RuleFormValues = z.infer<typeof ruleFormSchema>;

const FIELD_FOR_KEY: Record<string, keyof RuleFormValues> = {
  name: "name",
  type: "type",
  amount: "amount",
  category_id: "categoryId",
  payment_method_id: "paymentMethodId",
  merchant: "merchant",
  note: "note",
  frequency: "frequency",
  interval: "interval",
  start_on: "startOn",
  end_on: "endOn",
};

/** Map a 422 `errors[].loc` (["body", "amount"]) to a form field. */
export function fieldForLoc(loc: unknown[]): keyof RuleFormValues | undefined {
  const key = loc.find((part) => typeof part === "string" && part in FIELD_FOR_KEY);
  return typeof key === "string" ? FIELD_FOR_KEY[key] : undefined;
}
