import { groupTop } from "./breakdown";

const row = (id: string, amount: string, percent: string, count = 1) => ({
  category: { id, name: `Cat ${id}`, kind: "expense" as const, archived: false },
  amount,
  count,
  percent,
});

describe("groupTop", () => {
  it("returns everything as is for 6 categories or fewer", () => {
    const slices = groupTop([row("a", "10", "60.0"), row("b", "5", "40.0")]);
    expect(slices.map((s) => s.name)).toEqual(["Cat a", "Cat b"]);
  });

  it("returns an empty list for no rows", () => {
    expect(groupTop([])).toEqual([]);
  });

  it("sums the amount exactly in poisha and the percent in tenths", () => {
    const rows = ["a", "b", "c", "d", "e", "f"]
      .map((id) => row(id, "100", "10.0"))
      .concat([row("g", "0.10", "0.1", 2), row("h", "0.20", "0.2", 3)]);
    const other = groupTop(rows)[6]!;
    expect(other).toMatchObject({
      key: "other",
      name: "Other",
      amount: "0.30",
      percent: "0.3",
      count: 5,
    });
  });
});
