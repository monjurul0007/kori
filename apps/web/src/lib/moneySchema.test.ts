import { AMOUNT_ERRORS } from "./money";
import { moneyAmount } from "./moneySchema";

const messageFor = (input: string) => {
  const result = moneyAmount.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("moneyAmount", () => {
  it.each(["250", "250.50", "১২৫০", "৳ 1,250.5", "100000000000"])("accepts %s", (input) => {
    expect(messageFor(input)).toBeNull();
  });

  it.each([
    ["", AMOUNT_ERRORS.missing],
    ["abc", AMOUNT_ERRORS.missing],
    ["1e3", AMOUNT_ERRORS.missing],
    ["12.345", AMOUNT_ERRORS.tooManyDecimals],
    ["0", AMOUNT_ERRORS.notPositive],
    ["-50", AMOUNT_ERRORS.notPositive],
    ["100000000000.01", AMOUNT_ERRORS.tooLarge],
    ["99999999999999999999", AMOUNT_ERRORS.tooLarge],
  ])("rejects %j with the shared copy", (input, message) => {
    expect(messageFor(input)).toBe(message);
  });
});
