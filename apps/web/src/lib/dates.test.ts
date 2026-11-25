import {
  addDays,
  addMonths,
  defaultDateForMonth,
  endOfMonth,
  formatDisplayDate,
  formatMonth,
  formatMonthShort,
  monthName,
  monthOf,
  shortMonthName,
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

describe("monthName", () => {
  it("returns just the month's name", () => {
    expect(monthName("2026-11")).toBe("November");
  });
});

describe("addDays", () => {
  it("moves across month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-09-10", 0)).toBe("2026-09-10");
  });
});

describe("defaultDateForMonth", () => {
  it("is the month's last day for a past month", () => {
    expect(defaultDateForMonth("2026-10", "2026-11-24")).toBe("2026-10-31");
    expect(defaultDateForMonth("2024-02", "2026-11-24")).toBe("2024-02-29");
  });
  it("is today for the current month", () => {
    expect(defaultDateForMonth("2026-11", "2026-11-24")).toBe("2026-11-24");
  });
});

describe("short month names", () => {
  it("formats a month with a three-letter name and the year", () => {
    expect(formatMonthShort("2026-11")).toBe("Nov 2026");
  });

  it("names a month without the year", () => {
    expect(shortMonthName("2026-01")).toBe("Jan");
  });
});
