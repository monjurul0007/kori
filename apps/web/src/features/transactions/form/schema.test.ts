import { fieldForLoc, formSchema } from "./schema";

const valid = {
  type: "expense" as const,
  amount: "1,250.50",
  categoryId: "c1",
  lines: [],
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
    [["body", "lines", 0, "category_id"], "lines.0.categoryId"],
    [["body", "payment_method_id"], "paymentMethodId"],
  ])("maps %j to %s", (loc, field) => {
    expect(fieldForLoc(loc)).toBe(field);
  });

  it("returns undefined for unknown or empty locations", () => {
    expect(fieldForLoc(["body", "lines"])).toBeUndefined();
    expect(fieldForLoc([])).toBeUndefined();
  });
});

describe("formSchema lines", () => {
  const split = (lines: { categoryId: string; amount: string }[], amount = "0.30") => ({
    ...valid,
    amount,
    lines,
  });
  const issues = (v: unknown) => {
    const r = formSchema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("accepts lines that add up exactly (0.10 + 0.20 = 0.30)", () => {
    expect(
      issues(
        split([
          { categoryId: "a", amount: "0.10" },
          { categoryId: "b", amount: "0.20" },
        ]),
      ),
    ).toEqual([]);
  });

  it("rejects fewer than 2 lines", () => {
    expect(issues(split([{ categoryId: "a", amount: "0.30" }]))).toContain(
      "lines: A split needs at least 2 lines",
    );
  });

  it("rejects more than 20 lines", () => {
    const lines = Array.from({ length: 21 }, () => ({ categoryId: "a", amount: "1" }));
    expect(issues(split(lines, "21")).length).toBeGreaterThan(0);
  });

  it("rejects lines that don't add up, zero amounts and missing categories", () => {
    const out = issues(
      split([
        { categoryId: "", amount: "0" },
        { categoryId: "b", amount: "0.20" },
      ]),
    );
    expect(out).toContain("lines.0.categoryId: Pick a category");
    expect(out).toContain("lines.0.amount: Must be above zero");
    expect(out).toContain("lines: Lines must add up to the total");
  });

  it("needs a category only when not split", () => {
    expect(issues({ ...valid, categoryId: "" })).toContain("categoryId: Pick a category");
  });
});
