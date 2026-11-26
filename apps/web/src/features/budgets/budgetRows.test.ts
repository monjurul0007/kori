import { dailyAllowanceText, rowStatus, sortCategoryBudgets } from "./budgetRows";

const row = (id: string, remaining: string, percent: string) =>
  ({
    category: { id, name: id, kind: "expense", archived: false },
    limit: "1000.00",
    spent: "0.00",
    remaining,
    percent,
    level: "ok",
  }) as const;

describe("rowStatus", () => {
  it.each([
    ["-150.00", "115.0", "over", "৳150 over"],
    ["0.00", "100.0", "fully-used", "Fully used"],
    ["150.00", "85.0", "near-limit", "৳150 left"],
    ["151.00", "84.9", "on-track", "৳151 left"],
  ])("labels %s remaining at %s%% in words", (remaining, percent, state, label) => {
    expect(rowStatus({ remaining, percent })).toEqual({ state, label });
  });
});

describe("sortCategoryBudgets", () => {
  it("puts over budget first, then near the limit, then the rest in the given order", () => {
    const sorted = sortCategoryBudgets([
      row("calm-a", "600.00", "40.0"),
      row("near", "100.00", "90.0"),
      row("calm-b", "500.00", "50.0"),
      row("over", "-5.00", "100.5"),
    ]);
    expect(sorted.map((c) => c.category.id)).toEqual(["over", "near", "calm-a", "calm-b"]);
  });

  it("does not change the list it was given", () => {
    const input = [row("a", "600.00", "40.0"), row("b", "-5.00", "101.0")];
    sortCategoryBudgets(input);
    expect(input.map((c) => c.category.id)).toEqual(["a", "b"]);
  });
});

describe("dailyAllowanceText", () => {
  it("rounds the daily allowance down to whole taka", () => {
    expect(dailyAllowanceText("12650.00", 6)).toBe("Spend up to ৳2,108 a day to stay on budget.");
  });

  it.each([
    ["nothing left", "0.00", 6],
    ["over budget", "-10.00", 6],
    ["no days left", "500.00", 0],
  ])("gives no allowance when there is %s", (_case, remaining, daysLeft) => {
    expect(dailyAllowanceText(remaining, daysLeft)).toBeNull();
  });
});
