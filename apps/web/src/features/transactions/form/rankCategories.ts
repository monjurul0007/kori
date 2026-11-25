interface RankableTransaction {
  id: string;
  lines: { category: { id: string } }[];
}

interface Rankable {
  id: string;
  sort_order: number;
}

/**
 * Most-used first, by how often each category appears in the given rows; ties by sort_order.
 * A row cached under several queries (other months or filters) is counted once.
 */
export function rankCategories<C extends Rankable>(
  categories: C[],
  transactions: RankableTransaction[],
): C[] {
  const uses = new Map<string, number>();
  const uniqueTransactions = new Map(transactions.map((t) => [t.id, t]));
  for (const transaction of uniqueTransactions.values()) {
    for (const line of transaction.lines) {
      uses.set(line.category.id, (uses.get(line.category.id) ?? 0) + 1);
    }
  }
  const usesOf = (category: C) => uses.get(category.id) ?? 0;
  return [...categories].sort((a, b) => usesOf(b) - usesOf(a) || a.sort_order - b.sort_order);
}
