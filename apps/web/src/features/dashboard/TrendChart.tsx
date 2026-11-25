import { useState } from "react";

import { shortMonthName, formatMonth } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

import { QueryCard } from "./QueryCard";
import { useBudgetStatus, useTrend } from "./hooks";
import { axisTicks, formatShortTaka, largestTaka, shortAmount } from "./trendScale";

const WIDTH = 320;
const HEIGHT = 170;
const PLOT_LEFT = 34;
const PLOT_RIGHT = 312;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 140;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const MONTH_LABEL_Y = 156;
const BAR_WIDTH = 24;
const PAIRED_BAR_WIDTH = 15;
const BAR_GAP = 2;
const VALUE_LABEL_GAP = 4;
/** A non-zero month never shrinks below this, so a small expense is still visible. */
const MIN_BAR_HEIGHT = 2;

interface BarSpec {
  key: "expense" | "income";
  x: number;
  width: number;
  amount: string;
}

/** Expense bars, plus an income bar beside each when income is switched on. */
function barsFor(
  month: { expense: string; income: string },
  slotCenter: number,
  withIncome: boolean,
) {
  if (!withIncome) {
    const bar: BarSpec = {
      key: "expense",
      x: slotCenter - BAR_WIDTH / 2,
      width: BAR_WIDTH,
      amount: month.expense,
    };
    return [bar];
  }
  const expense: BarSpec = {
    key: "expense",
    x: slotCenter - PAIRED_BAR_WIDTH - BAR_GAP / 2,
    width: PAIRED_BAR_WIDTH,
    amount: month.expense,
  };
  const income: BarSpec = {
    key: "income",
    x: slotCenter + BAR_GAP / 2,
    width: PAIRED_BAR_WIDTH,
    amount: month.income,
  };
  return [expense, income];
}

/** Spending for the last 6 months. Expenses only unless income is switched on. */
export function TrendChart({ month }: { month: string }) {
  const query = useTrend(month);
  const budgetLimit = useBudgetStatus(month).data?.overall?.limit;
  const [withIncome, setWithIncome] = useState(false);

  return (
    <QueryCard
      title="Spending, last 6 months"
      query={query}
      action={
        <button
          type="button"
          aria-pressed={withIncome}
          aria-label="Show income"
          onClick={() => setWithIncome((on) => !on)}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium",
            withIncome ? "bg-brand-soft text-brand-text" : "text-brand-text hover:underline",
          )}
        >
          Income
        </button>
      }
    >
      {({ months }) => {
        const shown = months.flatMap((m) => (withIncome ? [m.expense, m.income] : [m.expense]));
        const ticks = axisTicks(largestTaka(budgetLimit ? [...shown, budgetLimit] : shown));
        const axisMax = Math.max(1, ticks.at(-1) ?? 1);
        const yOf = (taka: number) => PLOT_BOTTOM - (taka / axisMax) * PLOT_HEIGHT;
        const barHeight = (amount: string) => {
          const taka = largestTaka([amount]);
          if (taka === 0) return 0;
          return Math.max(MIN_BAR_HEIGHT, PLOT_BOTTOM - yOf(taka));
        };
        const slot = (PLOT_RIGHT - PLOT_LEFT) / months.length;
        const budgetY = budgetLimit ? yOf(largestTaka([budgetLimit])) : null;
        const summary = `Spending for the last 6 months, ${withIncome ? "expenses and income" : "expenses only"}; the table below has the values`;
        return (
          <div>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={summary}
              className="w-full"
            >
              {ticks.map((tick) => (
                <g key={tick} data-testid="axis-tick">
                  <line
                    x1={PLOT_LEFT}
                    x2={PLOT_RIGHT}
                    y1={yOf(tick)}
                    y2={yOf(tick)}
                    className="stroke-border"
                  />
                  <text
                    x={PLOT_LEFT - 6}
                    y={yOf(tick) + 3}
                    textAnchor="end"
                    fontSize="9"
                    className="fill-muted-foreground"
                  >
                    {formatShortTaka(tick)}
                  </text>
                </g>
              ))}
              {months.map((m, i) => {
                const center = PLOT_LEFT + slot * i + slot / 2;
                const current = m.month === month;
                return (
                  <g key={m.month} data-testid="trend-bar" data-month={m.month}>
                    {barsFor(m, center, withIncome).map((bar) => {
                      const height = barHeight(bar.amount);
                      const solid = current ? "fill-primary" : "fill-primary/30";
                      return (
                        <g key={bar.key}>
                          <rect
                            x={bar.x}
                            y={PLOT_BOTTOM - height}
                            width={bar.width}
                            height={height}
                            rx="4"
                            className={
                              bar.key === "expense"
                                ? solid
                                : current
                                  ? "fill-accent"
                                  : "fill-accent/40"
                            }
                          >
                            <title>{`${formatMonth(m.month)}, ${bar.key}: ${formatTaka(bar.amount)}`}</title>
                          </rect>
                          <text
                            x={bar.x + bar.width / 2}
                            y={PLOT_BOTTOM - height - VALUE_LABEL_GAP}
                            textAnchor="middle"
                            fontSize="9"
                            className="fill-foreground font-semibold"
                          >
                            {shortAmount(bar.amount)}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={center}
                      y={MONTH_LABEL_Y}
                      textAnchor="middle"
                      fontSize="9"
                      className={
                        current ? "fill-foreground font-semibold" : "fill-muted-foreground"
                      }
                    >
                      {shortMonthName(m.month)}
                    </text>
                  </g>
                );
              })}
              {budgetY !== null && budgetLimit && (
                <g data-testid="budget-line">
                  <line
                    x1={PLOT_LEFT}
                    x2={PLOT_RIGHT}
                    y1={budgetY}
                    y2={budgetY}
                    strokeDasharray="4 3"
                    strokeWidth="1.5"
                    className="stroke-accent"
                  />
                  <text
                    x={PLOT_RIGHT}
                    y={budgetY - 5}
                    textAnchor="end"
                    fontSize="9"
                    className="fill-warn font-semibold"
                  >
                    {`Budget ৳${shortAmount(budgetLimit)}`}
                  </text>
                </g>
              )}
            </svg>
            {/* sr-only goes on a wrapper: overflow clipping does not apply to <table>, so the table itself would still widen the page. */}
            <div className="sr-only">
              <table>
                <caption>Expense and income by month</caption>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Expense</th>
                    <th>Income</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}>
                      <th>{formatMonth(m.month)}</th>
                      <td>{formatTaka(m.expense)}</td>
                      <td>{formatTaka(m.income)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </QueryCard>
  );
}
