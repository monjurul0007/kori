import {
  addMonths,
  endOfMonth,
  formatDisplayDate,
  formatMonth,
  monthOf,
  startOfMonth,
  todayInDhaka,
} from "./dates";

describe("todayInDhaka", () => {
  it("rolls to the next day after 18:00 UTC", () => {
    expect(todayInDhaka(new Date("2026-09-28T17:59:59Z"))).toBe("2026-09-28");
    expect(todayInDhaka(new Date("2026-09-28T18:00:00Z"))).toBe("2026-09-29");
  });

  it("is still the previous day just before UTC midnight rolls over", () => {
    expect(todayInDhaka(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInDhaka(new Date("2026-01-01T00:30:00Z"))).toBe("2026-01-01");
  });
});

describe("month helpers", () => {
  it("finds the month and its bounds", () => {
    expect(monthOf("2026-09-28")).toBe("2026-09");
    expect(startOfMonth("2026-09")).toBe("2026-09-01");
    expect(endOfMonth("2026-09")).toBe("2026-09-30");
    expect(endOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("display formats", () => {
  it("formats a date like 'Mon, 28 Sep'", () => {
    expect(formatDisplayDate("2026-09-28")).toBe("Mon, 28 Sep");
  });

  it("formats a month like 'September 2026'", () => {
    expect(formatMonth("2026-09")).toBe("September 2026");
  });
});
