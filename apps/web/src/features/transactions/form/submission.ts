import { parseTakaInput } from "@/lib/money";
import { withTag } from "@/lib/tags";

import type { Transaction } from "../TransactionRow";
import type { TransactionBody } from "./mutations";
import type { FormValues } from "./schema";

type Category = Transaction["lines"][number]["category"];
type PaymentMethod = NonNullable<Transaction["payment_method"]>;

interface Context {
  categories: Category[];
  methods: PaymentMethod[];
  /** Tag text typed but not yet confirmed with Enter; it is saved too. */
  pendingTag: string;
  /** The row being edited, or nothing for a new one. */
  existing?: Transaction;
}

export interface Submission {
  body: TransactionBody;
  /** The row as we expect the server to return it, for the optimistic update. */
  preview: Transaction;
}

function previewLines(
  values: FormValues,
  body: TransactionBody,
  categories: Category[],
  amount: string,
): Transaction["lines"] {
  if (body.lines?.length) {
    return body.lines.flatMap((line) => {
      const category = categories.find((c) => c.id === line.category_id);
      return category ? [{ category, amount: line.amount, category_source: "user" as const }] : [];
    });
  }
  const category = categories.find((c) => c.id === values.categoryId);
  return category ? [{ category, amount, category_source: "user" as const }] : [];
}

export function buildSubmission(values: FormValues, context: Context): Submission {
  const { categories, methods, pendingTag, existing } = context;
  const tags = withTag(values.tags, pendingTag);
  const amount = parseTakaInput(values.amount) ?? values.amount;
  const lines = values.lines.map((l) => ({
    category_id: l.categoryId,
    amount: parseTakaInput(l.amount) ?? l.amount,
  }));
  const body: TransactionBody = {
    type: values.type,
    amount,
    occurred_on: values.occurredOn,
    merchant: values.merchant.trim() || null,
    note: values.note.trim() || null,
    payment_method_id: values.paymentMethodId || null,
    tags,
    ...(lines.length ? { lines } : { category_id: values.categoryId }),
  };
  const preview: Transaction = {
    id: existing?.id ?? `pending-${crypto.randomUUID()}`,
    source: existing?.source ?? "manual",
    recurring_rule_id: existing?.recurring_rule_id ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_split: lines.length > 0,
    type: values.type,
    amount,
    occurred_on: values.occurredOn,
    merchant: body.merchant ?? null,
    note: body.note ?? null,
    payment_method: methods.find((m) => m.id === values.paymentMethodId) ?? null,
    tags,
    lines: previewLines(values, body, categories, amount),
  };
  return { body, preview };
}
