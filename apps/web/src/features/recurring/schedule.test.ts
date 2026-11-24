import { describe, expect, it } from "vitest";

import { formatSchedule } from "./schedule";

const monthly = (start_on: string, interval = 1) =>
  formatSchedule({ frequency: "monthly", interval, start_on });

describe("formatSchedule", () => {
  it.each([
    ["2026-12-01", "Monthly on the 1st"],
    ["2026-12-02", "Monthly on the 2nd"],
    ["2026-12-03", "Monthly on the 3rd"],
    ["2026-12-11", "Monthly on the 11th"],
    ["2026-12-21", "Monthly on the 21st"],
    ["2026-12-31", "Monthly on the 31st"],
  ])("monthly from %s", (start, text) => expect(monthly(start)).toBe(text));

  it("handles every N months", () => {
    expect(monthly("2026-12-05", 3)).toBe("Every 3 months on the 5th");
  });

  it("weekly uses the weekday of the start date", () => {
    // 2026-11-28 is a Saturday.
    expect(formatSchedule({ frequency: "weekly", interval: 1, start_on: "2026-11-28" })).toBe(
      "Weekly on Saturday",
    );
    expect(formatSchedule({ frequency: "weekly", interval: 2, start_on: "2026-11-28" })).toBe(
      "Every 2 weeks on Saturday",
    );
  });

  it("yearly uses the day and month", () => {
    expect(formatSchedule({ frequency: "yearly", interval: 1, start_on: "2026-03-15" })).toBe(
      "Yearly on 15 March",
    );
    expect(formatSchedule({ frequency: "yearly", interval: 2, start_on: "2026-03-15" })).toBe(
      "Every 2 years on 15 March",
    );
  });

  it("returns an empty string for an unfinished date", () => {
    expect(monthly("")).toBe("");
  });
});
