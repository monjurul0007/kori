import type { Transaction } from "../TransactionRow";

interface Rankable {
  id: string;
  sort_order: number;
}

/** Most-used first, by how often each category appears in the given rows; ties by sort_order. */
export function rankCategories<C extends Rankable>(
  categories: C[],
  transactions: Transaction[],
): C[] {
  const uses = new Map<string, number>();
  for (const transaction of transactions) {
    for (const line of transaction.lines) {
      uses.set(line.category.id, (uses.get(line.category.id) ?? 0) + 1);
    }
  }
  const usesOf = (category: C) => uses.get(category.id) ?? 0;
  return [...categories].sort((a, b) => usesOf(b) - usesOf(a) || a.sort_order - b.sort_order);
}
