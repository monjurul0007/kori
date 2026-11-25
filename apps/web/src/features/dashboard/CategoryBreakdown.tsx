import { Link } from "react-router-dom";

import { formatTaka } from "@/lib/money";

import { QueryCard } from "./QueryCard";
import { SLICE_COLORS, groupTop, type Slice } from "./breakdown";
import { useSpending } from "./hooks";

const OTHER_KEY = "other";
const LINK_CLASS = "text-sm font-medium text-brand-text hover:underline";

const colorOf = (index: number) => SLICE_COLORS[index % SLICE_COLORS.length];

/** "Other" rolls several categories together, so it has no single category to filter by. */
function categoryHref(month: string, slice: Slice): string | null {
  if (slice.key === OTHER_KEY) return null;
  return `/transactions?month=${month}&category_id=${slice.key}`;
}

function StackedBar({ slices, total }: { slices: Slice[]; total: string }) {
  return (
    <div
      role="img"
      aria-label={`Spending by category, total ${formatTaka(total)}`}
      className="flex h-3 gap-0.5 overflow-hidden rounded-full"
    >
      {slices.map((slice, index) => (
        <div
          key={slice.key}
          data-testid="stack-segment"
          className="h-full"
          style={{ width: `${slice.percent}%`, backgroundColor: colorOf(index) }}
        />
      ))}
    </div>
  );
}

function CategoryRow({ month, slice, index }: { month: string; slice: Slice; index: number }) {
  const href = categoryHref(month, slice);
  const name = href ? (
    <Link to={href} className="truncate hover:underline">
      {slice.name}
    </Link>
  ) : (
    <span className="truncate">{slice.name}</span>
  );
  return (
    <li className="grid min-h-11 grid-cols-[10px_1fr_auto_3.6em] items-center gap-2.5 text-sm">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ backgroundColor: colorOf(index) }}
      />
      {name}
      <span className="font-semibold tabular-nums">{formatTaka(slice.amount)}</span>
      <span className="text-right tabular-nums text-muted-foreground">{slice.percent}%</span>
    </li>
  );
}

export function CategoryBreakdown({ month }: { month: string }) {
  const query = useSpending(month);
  return (
    <QueryCard
      title="Where it went"
      query={query}
      action={
        <Link to={`/transactions?month=${month}&type=expense`} className={LINK_CLASS}>
          All categories
        </Link>
      }
    >
      {(report) => {
        const slices = groupTop(report.by_category);
        if (slices.length === 0) {
          return <p className="text-sm text-muted-foreground">No spending this month.</p>;
        }
        return (
          <div className="space-y-3">
            <StackedBar slices={slices} total={report.total} />
            <ul>
              {slices.map((slice, index) => (
                <CategoryRow key={slice.key} month={month} slice={slice} index={index} />
              ))}
            </ul>
          </div>
        );
      }}
    </QueryCard>
  );
}
