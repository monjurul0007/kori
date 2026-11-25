import { formatMonth } from "@/lib/dates";
import { formatTaka, toPoisha } from "@/lib/money";

import { QueryCard } from "./QueryCard";
import { useTrend } from "./hooks";

const W = 300;
const H = 120;
const PAD_TOP = 6;
const LABEL_H = 16;
const PLOT_H = H - PAD_TOP - LABEL_H;

const short = (month: string) => formatMonth(month).slice(0, 3);

/** Expense bars with income beside them; the selected month is drawn in full colour. */
export function TrendChart({ month }: { month: string }) {
  const query = useTrend(month);
  return (
    <QueryCard title="Last 6 months" query={query}>
      {({ months }) => {
        const scale = (v: string) => Number(toPoisha(v));
        const max = Math.max(1, ...months.flatMap((m) => [scale(m.expense), scale(m.income)]));
        const slot = W / months.length;
        const bar = slot * 0.32;
        const height = (v: string) => (scale(v) / max) * PLOT_H;
        return (
          <div className="space-y-2">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Expense and income for the last 6 months; the table below has the values"
              className="w-full"
            >
              {months.map((m, i) => {
                const x = i * slot + slot / 2;
                const current = m.month === month;
                return (
                  <g key={m.month} data-testid="trend-bar" data-month={m.month}>
                    <rect
                      x={x - bar - 1}
                      y={PAD_TOP + PLOT_H - height(m.expense)}
                      width={bar}
                      height={height(m.expense)}
                      rx="2"
                      className={current ? "fill-primary" : "fill-primary/40"}
                    />
                    <rect
                      x={x + 1}
                      y={PAD_TOP + PLOT_H - height(m.income)}
                      width={bar}
                      height={height(m.income)}
                      rx="2"
                      className={current ? "fill-accent" : "fill-accent/40"}
                    />
                    <text
                      x={x}
                      y={H - 3}
                      textAnchor="middle"
                      className={
                        current ? "fill-foreground font-semibold" : "fill-muted-foreground"
                      }
                      fontSize="9"
                    >
                      {short(m.month)}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="flex gap-4 text-xs text-muted-foreground" aria-hidden="true">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-primary" /> Expense
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-accent" /> Income
              </span>
            </p>
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
