import type { components } from "@/api/schema";
import { fromPoisha, toPoisha } from "@/lib/money";

type Row = components["schemas"]["CategorySpending"];

export interface Slice {
  key: string;
  name: string;
  amount: string;
  percent: string;
  count: number;
}

export const TOP = 6;

/** The top 6 categories as they are, then everything else rolled into "Other". */
export function groupTop(rows: Row[]): Slice[] {
  const slice = (r: Row): Slice => ({
    key: r.category.id,
    name: r.category.name,
    amount: r.amount,
    percent: r.percent,
    count: r.count,
  });
  const top = rows.slice(0, TOP).map(slice);
  const rest = rows.slice(TOP);
  if (rest.length === 0) return top;
  const poisha = rest.reduce((sum, r) => sum + toPoisha(r.amount), 0n);
  // Percent is shown to one decimal place, so add in tenths (integers) and format once.
  const tenths = rest.reduce((sum, r) => sum + Math.round(Number(r.percent) * 10), 0);
  return [
    ...top,
    {
      key: "other",
      name: "Other",
      amount: fromPoisha(poisha),
      percent: `${Math.floor(tenths / 10)}.${tenths % 10}`,
      count: rest.reduce((sum, r) => sum + r.count, 0),
    },
  ];
}

/** Chart colours, in slice order. Each slice is also labelled in the list, never colour alone. */
export const SLICE_COLORS = [
  "#0c6e51",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#6b7280",
];
