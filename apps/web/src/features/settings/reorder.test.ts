import { nextSortOrder, planMove } from "./reorder";

const list = (...orders: number[]) => orders.map((sort_order, i) => ({ id: `i${i}`, sort_order }));

describe("planMove", () => {
  it("swaps the sort_order of two neighbours", () => {
    expect(planMove(list(10, 20, 30), 1, -1)).toEqual([
      { id: "i1", sort_order: 10 },
      { id: "i0", sort_order: 20 },
    ]);
    expect(planMove(list(10, 20, 30), 1, 1)).toEqual([
      { id: "i1", sort_order: 30 },
      { id: "i2", sort_order: 20 },
    ]);
  });

  it("renumbers the list when neighbours share a sort_order", () => {
    const patches = planMove(list(0, 0, 0), 2, -1);
    // New order is i0, i2, i1 at 10, 20, 30; i0's 0 -> 10 etc. are all written.
    expect(patches).toContainEqual({ id: "i2", sort_order: 20 });
    expect(patches).toContainEqual({ id: "i1", sort_order: 30 });
  });

  it("does nothing at the ends", () => {
    expect(planMove(list(10, 20), 0, -1)).toEqual([]);
    expect(planMove(list(10, 20), 1, 1)).toEqual([]);
  });
});

describe("nextSortOrder", () => {
  it("goes after the highest", () => {
    expect(nextSortOrder(list(10, 40, 20))).toBe(50);
    expect(nextSortOrder([])).toBe(10);
  });
});
