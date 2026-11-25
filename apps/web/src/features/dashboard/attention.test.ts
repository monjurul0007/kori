import { buildAttention } from "./attention";

const line = (name: string, spent: string, limit: string, percent: string, level: string) => ({
  category: { id: `id-${name}`, name, kind: "expense" as const, archived: false },
  limit,
  spent,
  remaining: (Number(limit) - Number(spent)).toString(),
  percent,
  level: level as "ok" | "warning" | "over",
});

describe("buildAttention", () => {
  it("says how far over an over-budget category is", () => {
    const [item] = buildAttention([line("Food & Dining", "3150", "3000", "105.0", "over")], 6);
    expect(item).toMatchObject({ kind: "over", categoryId: "id-Food & Dining" });
    expect(item!.lead).toBe("Food & Dining is ৳150 over");
    expect(item!.rest).toBe(" its ৳3,000 budget.");
  });

  it("says how much is left for a near-limit category, with the days left", () => {
    const [item] = buildAttention([line("Groceries", "4200", "5000", "84.0", "warning")], 6);
    expect(item).toMatchObject({ kind: "near-limit", lead: "Groceries has ৳800 left" });
    expect(item!.rest).toBe(" for the last 6 days.");
  });

  it("uses the singular on the last day and drops the window in a past month", () => {
    const category = line("Groceries", "4200", "5000", "84.0", "warning");
    expect(buildAttention([category], 1)[0]!.rest).toBe(" for the last day.");
    expect(buildAttention([category], 0)[0]!.rest).toBe(".");
  });

  it("treats a budget used to the last taka as fully used, not over", () => {
    const [item] = buildAttention([line("Rent", "15000", "15000", "100.0", "over")], 6);
    expect(item).toMatchObject({ kind: "fully-used", lead: "Rent is fully used." });
  });

  it("skips categories that are fine", () => {
    expect(buildAttention([line("Fun", "100", "5000", "2.0", "ok")], 6)).toEqual([]);
  });

  it("orders over, then near the limit, then fully used, fullest budget first", () => {
    const items = buildAttention(
      [
        line("Rent", "15000", "15000", "100.0", "over"),
        line("Groceries", "4200", "5000", "84.0", "warning"),
        line("Bills", "1100", "1000", "110.0", "over"),
        line("Food", "3150", "3000", "105.0", "over"),
        line("Transport", "950", "1000", "95.0", "warning"),
      ],
      6,
    );
    expect(items.map((i) => i.categoryId)).toEqual([
      "id-Bills",
      "id-Food",
      "id-Transport",
      "id-Groceries",
      "id-Rent",
    ]);
  });
});
