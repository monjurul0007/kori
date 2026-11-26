import { Pencil } from "lucide-react";

import type { components } from "@/api/schema";
import { CategoryTile } from "@/components/ui/category-tile";
import { IconButton } from "@/components/ui/icon-button";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

import { rowStatus, type RowState } from "./budgetRows";

type CategoryStatus = components["schemas"]["CategoryBudgetStatus"];

const BAR: Record<RowState, string> = {
  over: "bg-over",
  "near-limit": "bg-accent",
  "fully-used": "bg-primary",
  "on-track": "bg-primary",
};

const BADGE: Record<RowState, string> = {
  over: "bg-over/10 text-over",
  "near-limit": "bg-accent/20 text-foreground",
  "fully-used": "bg-muted text-muted-foreground",
  "on-track": "bg-primary/10 text-primary",
};

interface Props {
  budget: CategoryStatus;
  icon: string | null;
  color: string | null;
  /** Undefined in a past month, where the row can't be edited. */
  onEdit?: () => void;
}

/** One category budget: tile, name, bar, "spent of limit" and its status in words. */
export function CategoryBudgetRow({ budget, icon, color, onEdit }: Props) {
  const { state, label } = rowStatus(budget);
  const name = budget.category.name;
  const width = Math.min(100, Number(budget.percent));
  const content = (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto_auto]">
      <CategoryTile icon={icon} color={color} />
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span
        className={cn(
          "col-start-3 row-start-1 rounded-full px-2.5 py-1 text-xs font-semibold md:col-start-5",
          BADGE[state],
        )}
      >
        {label}
      </span>
      <div
        role="progressbar"
        aria-label={`${name} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${budget.percent.replace(/\.0$/, "")}% used`}
        className="col-span-3 h-2.5 overflow-hidden rounded-full bg-muted md:col-span-1 md:col-start-3 md:row-start-1"
      >
        <div className={cn("h-full rounded-full", BAR[state])} style={{ width: `${width}%` }} />
      </div>
      <span className="col-span-3 text-sm tabular-nums text-muted-foreground md:col-span-1 md:col-start-4 md:row-start-1">
        {formatTaka(budget.spent)} of {formatTaka(budget.limit)}
      </span>
    </div>
  );
  return (
    <li className="flex items-center gap-1 py-3">
      <div className="min-w-0 flex-1">{content}</div>
      {onEdit && (
        <IconButton aria-label={`Edit ${name} budget`} onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      )}
    </li>
  );
}
