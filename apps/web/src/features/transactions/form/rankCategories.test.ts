import { bills, food, makeTx } from "../fixtures";
import { rankCategories } from "./rankCategories";

const categories = [
  { ...bills, sort_order: 1 },
  { ...food, sort_order: 2 },
];

describe("rankCategories", () => {
  it("puts the most-used category first", () => {
    const transactions = [makeTx("a"), makeTx("b")]; // both in food
    expect(rankCategories(categories, transactions).map((c) => c.id)).toEqual([
      "c-food",
      "c-bills",
    ]);
  });

  it("falls back to sort_order when nothing has been used", () => {
    expect(rankCategories(categories, []).map((c) => c.id)).toEqual(["c-bills", "c-food"]);
  });

  it("breaks ties by sort_order and leaves the input untouched", () => {
    const tied = [
      { id: "b", sort_order: 2 },
      { id: "a", sort_order: 1 },
    ];
    expect(rankCategories(tied, []).map((c) => c.id)).toEqual(["a", "b"]);
    expect(tied.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("counts a transaction once even when several cached queries hold it", () => {
    const seenTwice = makeTx("a"); // food
    const bills1 = makeTx("b", {
      lines: [{ category: bills, amount: "1", category_source: "user" }],
    });
    const bills2 = makeTx("c", {
      lines: [{ category: bills, amount: "1", category_source: "user" }],
    });
    // food appears 3 times across queries but is one row; bills is two different rows.
    const transactions = [seenTwice, seenTwice, seenTwice, bills1, bills2];
    expect(rankCategories(categories, transactions).map((c) => c.id)).toEqual([
      "c-bills",
      "c-food",
    ]);
  });
});
