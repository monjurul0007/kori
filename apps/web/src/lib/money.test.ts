import {
  formatTaka,
  fromPoisha,
  parseTakaInput,
  stripValueErrorPrefix,
  toPoisha,
  validateAmount,
} from "./money";

describe("formatTaka", () => {
  it.each([
    ["5", "৳5"],
    ["350", "৳350"],
    ["1250", "৳1,250"],
    ["12500", "৳12,500"],
    ["100000", "৳1,00,000"],
    ["1250000", "৳12,50,000"],
    ["12345678", "৳1,23,45,678"],
    ["123456789", "৳12,34,56,789"],
  ])("groups %s in lakhs", (input, expected) => {
    expect(formatTaka(input)).toBe(expected);
  });

  it("shows decimals only for fractional amounts", () => {
    expect(formatTaka("1250000.5")).toBe("৳12,50,000.50");
    expect(formatTaka("350.00")).toBe("৳350");
    expect(formatTaka("0.05")).toBe("৳0.05");
  });

  it("keeps the sign and drops leading zeros", () => {
    expect(formatTaka("-1500")).toBe("-৳1,500");
    expect(formatTaka("007")).toBe("৳7");
  });

  it("rejects bad input", () => {
    expect(() => formatTaka("12.345")).toThrow();
    expect(() => formatTaka("abc")).toThrow();
  });
});

describe("parseTakaInput", () => {
  it("normalises typed amounts to decimal strings", () => {
    expect(parseTakaInput("1250")).toBe("1250");
    expect(parseTakaInput("৳ 1,250.5")).toBe("1250.50");
    expect(parseTakaInput("০০৭.২৫")).toBe("7.25");
    expect(parseTakaInput("১২৫০")).toBe("1250");
  });

  it("returns null for invalid input", () => {
    expect(parseTakaInput("")).toBeNull();
    expect(parseTakaInput("abc")).toBeNull();
    expect(parseTakaInput("1.234")).toBeNull();
    expect(parseTakaInput("-5")).toBeNull();
    expect(parseTakaInput("1e5")).toBeNull();
  });
});

describe("poisha helpers", () => {
  it("round-trips exactly", () => {
    expect(fromPoisha(toPoisha("1250.5") + toPoisha("0.10"))).toBe("1250.60");
    expect(fromPoisha(toPoisha("10") - toPoisha("12.50"))).toBe("-2.50");
  });
});

describe("validateAmount", () => {
  it.each([
    ["", "Enter an amount"],
    ["abc", "Enter an amount"],
    ["1.234", "Use up to 2 decimal places"],
    ["0", "Must be above zero"],
    ["0.00", "Must be above zero"],
    ["-1", "Must be above zero"],
    ["100000000000.01", "That's more than ৳1,00,00,00,00,000"],
    ["99999999999999", "That's more than ৳1,00,00,00,00,000"],
  ])("explains %j", (input, message) => {
    expect(validateAmount(input)).toBe(message);
  });

  it.each(["1.5", "1250", "৳ 1,250.50", "১২৫০", "100000000000", "0.01"])("accepts %j", (input) => {
    expect(validateAmount(input)).toBeNull();
  });
});

describe("stripValueErrorPrefix", () => {
  it("removes the pydantic prefix", () => {
    expect(stripValueErrorPrefix("Value error, Amount is too large")).toBe("Amount is too large");
  });

  it("leaves other messages alone", () => {
    expect(stripValueErrorPrefix("Pick a category")).toBe("Pick a category");
  });
});
