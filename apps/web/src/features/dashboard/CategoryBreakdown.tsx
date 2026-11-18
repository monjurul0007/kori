import { formatTaka } from "@/lib/money";

import { QueryCard } from "./QueryCard";
import { SLICE_COLORS, groupTop, type Slice } from "./breakdown";
import { useSpending } from "./hooks";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A donut of spending by category. The list beside it carries the same numbers as text. */
function Donut({ slices, total }: { slices: Slice[]; total: string }) {
  const lengths = slices.map((s) => (Number(s.percent) / 100) * CIRCUMFERENCE);
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Spending by category, total ${formatTaka(total)}`}
      className="h-40 w-40 shrink-0 -rotate-90"
    >
      {slices.map((s, i) => (
        <circle
          key={s.key}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
          strokeWidth="16"
          strokeDasharray={`${lengths[i]} ${CIRCUMFERENCE - (lengths[i] ?? 0)}`}
          strokeDashoffset={-lengths.slice(0, i).reduce((sum, l) => sum + l, 0)}
        />
      ))}
    </svg>
  );
}

export function CategoryBreakdown({ month }: { month: string }) {
  const query = useSpending(month);
  return (
    <QueryCard title="Where the money went" query={query}>
      {(report) => {
        const slices = groupTop(report.by_category);
        if (slices.length === 0) {
          return <p className="text-sm text-muted-foreground">No spending this month.</p>;
        }
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Donut slices={slices} total={report.total} />
            </div>
            <ul className="space-y-3">
              {slices.map((s, i) => (
                <li key={s.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                      />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatTaka(s.amount)} · {s.percent}%
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Number(s.percent))}%`,
                        backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </QueryCard>
  );
}
