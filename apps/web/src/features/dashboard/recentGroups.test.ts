import { makeTx } from "../transactions/fixtures";
import { dayLabel, groupByDay, limitRows } from "./recentGroups";

const TODAY = "2026-11-25";

describe("dayLabel", () => {
  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel("2026-11-25", TODAY)).toBe("Today");
    expect(dayLabel("2026-11-24", TODAY)).toBe("Yesterday");
    expect(dayLabel("2026-11-20", TODAY)).toBe("Fri, 20 Nov");
  });

  it("says Yesterday across a month boundary", () => {
    expect(dayLabel("2026-10-31", "2026-11-01")).toBe("Yesterday");
  });
});

describe("groupByDay", () => {
  it("groups by day in order and totals only expenses, to the poisha", () => {
    const groups = groupByDay(
      [
        makeTx("a", { occurred_on: "2026-11-25", amount: "320.50" }),
        makeTx("b", { occurred_on: "2026-11-25", amount: "850.25" }),
        makeTx("c", { occurred_on: "2026-11-25", amount: "50000", type: "income" }),
        makeTx("d", { occurred_on: "2026-11-24", amount: "1000" }),
      ],
      TODAY,
    );
    expect(groups.map((g) => [g.label, g.spent, g.transactions.length])).toEqual([
      ["Today", "1170.75", 3],
      ["Yesterday", "1000.00", 1],
    ]);
  });

  it("returns no groups for no transactions", () => {
    expect(groupByDay([], TODAY)).toEqual([]);
  });
});

describe("limitRows", () => {
  const manyOnOneDay = Array.from({ length: 8 }, (_, i) =>
    makeTx(`t${i}`, { occurred_on: "2026-11-25", amount: "100" }),
  );

  it("keeps the day total of every row even when only some rows are shown", () => {
    const [group] = limitRows(groupByDay(manyOnOneDay, TODAY), 6);
    expect(group!.transactions).toHaveLength(6);
    expect(group!.spent).toBe("800.00");
  });

  it("spreads the row limit across days and drops days past it", () => {
    const groups = limitRows(
      groupByDay(
        [
          makeTx("a", { occurred_on: "2026-11-25" }),
          makeTx("b", { occurred_on: "2026-11-24" }),
          makeTx("c", { occurred_on: "2026-11-24" }),
          makeTx("d", { occurred_on: "2026-11-23" }),
        ],
        TODAY,
      ),
      2,
    );
    expect(groups.map((g) => g.transactions.length)).toEqual([1, 1]);
  });
});
