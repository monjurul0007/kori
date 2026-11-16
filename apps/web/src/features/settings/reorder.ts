export interface Orderable {
  id: string;
  sort_order: number;
}

export interface OrderPatch {
  id: string;
  sort_order: number;
}

const STEP = 10;

/**
 * The PATCHes that move `items[index]` one place up or down (`items` are the active ones in
 * display order). Neighbours swap their `sort_order`; if they tie, the whole list is
 * renumbered (10, 20, 30…) with the move applied, so the order is unambiguous afterwards.
 */
export function planMove(items: Orderable[], index: number, dir: -1 | 1): OrderPatch[] {
  const other = index + dir;
  if (index < 0 || index >= items.length || other < 0 || other >= items.length) return [];
  const a = items[index]!;
  const b = items[other]!;
  if (a.sort_order !== b.sort_order) {
    return [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ];
  }
  const moved = [...items];
  moved[index] = b;
  moved[other] = a;
  return moved
    .map((item, i) => ({ id: item.id, sort_order: (i + 1) * STEP }))
    .filter((patch, i) => patch.sort_order !== moved[i]!.sort_order);
}

/** A `sort_order` that places a new item after every existing one. */
export function nextSortOrder(items: Orderable[]): number {
  return items.reduce((max, i) => Math.max(max, i.sort_order), 0) + STEP;
}
