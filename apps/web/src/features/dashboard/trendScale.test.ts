import { axisTicks, formatShortTaka, largestTaka, shortAmount } from "./trendScale";

describe("axisTicks", () => {
  it.each([
    [0, [0]],
    [900, [0, 300, 600, 900]],
    [33_400, [0, 15_000, 30_000, 45_000]],
    [1_250_000, [0, 500_000, 1_000_000, 1_500_000]],
  ])("gives round ticks that cover %i", (max, expected) => {
    expect(axisTicks(max)).toEqual(expected);
  });

  it("always reaches at least the largest value", () => {
    for (const max of [1, 7, 99, 101, 2_501, 48_000, 999_999]) {
      expect(axisTicks(max).at(-1)).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("formatShortTaka", () => {
  it.each([
    [0, "0"],
    [880, "880"],
    [1_000, "1k"],
    [31_200, "31.2k"],
    [15_000, "15k"],
    [999_960, "1M"],
    [1_500_000, "1.5M"],
  ])("formats %i as %s", (taka, expected) => {
    expect(formatShortTaka(taka)).toBe(expected);
  });
});

describe("shortAmount", () => {
  it("drops the paisa and reads a decimal string exactly", () => {
    expect(shortAmount("31249.99")).toBe("31.2k");
    expect(shortAmount("880.50")).toBe("880");
  });
});

describe("largestTaka", () => {
  it("rounds the largest amount up to whole taka", () => {
    expect(largestTaka(["880.50", "12.00"])).toBe(881);
  });

  it("is 0 for no amounts or all zeros", () => {
    expect(largestTaka([])).toBe(0);
    expect(largestTaka(["0", "0.00"])).toBe(0);
  });
});
