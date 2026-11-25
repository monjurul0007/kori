import { computeHero } from "./hero";

const overall = (over = {}) => ({
  limit: "40000",
  limit_source: "set" as const,
  spent: "27350",
  remaining: "12650",
  percent: "68.4",
  level: "ok" as const,
  ...over,
});
const opts = (over = {}) => ({
  month: "2026-11",
  monthName: "November",
  daysLeft: 6,
  today: "2026-11-25",
  ...over,
});

describe("computeHero", () => {
  it("shows what is left and a whole-taka daily allowance rounded down", () => {
    const hero = computeHero(overall(), opts());
    expect(hero).toMatchObject({
      amount: "12650.00",
      isOver: false,
      spentOfLimit: "৳27,350 of ৳40,000 spent",
      dailyAllowance: "Spend up to ৳2,108 a day to finish November on budget.",
    });
  });

  it("keeps cents out of the allowance: 100.99 over 1 day is 100", () => {
    const hero = computeHero(overall({ remaining: "100.99" }), opts({ daysLeft: 1 }));
    expect(hero.dailyAllowance).toBe("Spend up to ৳100 a day to finish November on budget.");
  });

  it("offers the whole remainder on the last day of the month", () => {
    const hero = computeHero(overall(), opts({ daysLeft: 1, today: "2026-11-30" }));
    expect(hero.dailyAllowance).toBe("Spend up to ৳12,650 a day to finish November on budget.");
  });

  it("reports the overspend as a positive amount, with no allowance", () => {
    const hero = computeHero(
      overall({ spent: "41200", remaining: "-1200", percent: "103.0", level: "over" }),
      opts(),
    );
    expect(hero).toMatchObject({ amount: "1200.00", isOver: true, dailyAllowance: null });
  });

  it("caps the bar at 100 when over budget", () => {
    const hero = computeHero(overall({ remaining: "-1200", percent: "103.0" }), opts());
    expect(hero.barPercent).toBe(100);
  });

  it("gives no daily allowance for a past month", () => {
    const hero = computeHero(overall(), opts({ month: "2026-10", daysLeft: 0 }));
    expect(hero.dailyAllowance).toBeNull();
  });

  it("gives no daily allowance when nothing is left", () => {
    const hero = computeHero(overall({ remaining: "0" }), opts());
    expect(hero).toMatchObject({ isOver: false, dailyAllowance: null });
  });

  it("gives no daily allowance for a future month, even with days left", () => {
    const hero = computeHero(overall(), opts({ month: "2026-12", daysLeft: 31 }));
    expect(hero.dailyAllowance).toBeNull();
  });
});
