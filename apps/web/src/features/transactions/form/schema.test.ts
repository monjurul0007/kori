import { fieldForLoc, formSchema } from "./schema";

const valid = {
  type: "expense" as const,
  amount: "1,250.50",
  categoryId: "c1",
  occurredOn: "2026-09-10",
  merchant: "",
  paymentMethodId: "",
  tags: [],
  note: "",
};

const messages = (over: Record<string, unknown>) => {
  const result = formSchema.safeParse({ ...valid, ...over });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("formSchema", () => {
  it("accepts a valid expense", () => {
    expect(formSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["1250.5", "১২৫০", "৳ 1,250"])("accepts the amount %s", (amount) => {
    expect(messages({ amount })).toEqual([]);
  });

  it.each(["", "abc", "1.234", "-5"])("rejects the amount %j", (amount) => {
    expect(messages({ amount })).toContain("Enter an amount like 1,250.50");
  });

  it.each(["0", "0.00"])("rejects zero (%s)", (amount) => {
    expect(messages({ amount })).toContain("Must be above zero");
  });

  it("requires a category and a date", () => {
    expect(messages({ categoryId: "" })).toContain("Pick a category");
    expect(messages({ occurredOn: "" })).toContain("Pick a date");
  });

  it("limits merchant and note lengths like the API", () => {
    expect(messages({ merchant: "x".repeat(121) })).toContain("At most 120 characters");
    expect(messages({ note: "x".repeat(501) })).toContain("At most 500 characters");
  });
});

describe("fieldForLoc", () => {
  it.each([
    [["body", "amount"], "amount"],
    [["body", "occurred_on"], "occurredOn"],
    [["body", "category_id"], "categoryId"],
    [["body", "lines", 0, "category_id"], "categoryId"],
    [["body", "payment_method_id"], "paymentMethodId"],
  ])("maps %j to %s", (loc, field) => {
    expect(fieldForLoc(loc)).toBe(field);
  });

  it("returns undefined for unknown or empty locations", () => {
    expect(fieldForLoc(["body", "lines"])).toBeUndefined();
    expect(fieldForLoc([])).toBeUndefined();
  });
});
