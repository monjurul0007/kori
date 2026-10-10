import type { Transaction } from "./TransactionRow";

export const food = { id: "c-food", name: "Food & Dining", kind: "expense" as const };
export const bills = { id: "c-bills", name: "Bills", kind: "expense" as const };

export const makeTx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  type: "expense",
  amount: "250",
  occurred_on: "2026-09-10",
  merchant: `Shop ${id}`,
  note: null,
  payment_method: { id: "pm1", name: "bKash" },
  lines: [{ category: food, amount: "250", category_source: "user" }],
  tags: [],
  is_split: false,
  source: "manual",
  created_at: "2026-09-10T00:00:00Z",
  updated_at: "2026-09-10T00:00:00Z",
  ...over,
});
