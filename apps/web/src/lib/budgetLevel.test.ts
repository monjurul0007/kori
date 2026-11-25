import { shortPercent } from "./budgetLevel";

describe("shortPercent", () => {
  it("trims a trailing .0 from percentages", () => {
    expect(shortPercent("85.0")).toBe("85");
    expect(shortPercent("34.5")).toBe("34.5");
    expect(shortPercent("100.0")).toBe("100");
  });
});
