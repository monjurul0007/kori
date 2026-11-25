import { AlertTriangle, Check, OctagonAlert, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { buildAttention, type AttentionKind } from "./attention";
import { useBudgetStatus } from "./hooks";

const STYLE: Record<AttentionKind, { icon: LucideIcon; row: string }> = {
  over: { icon: OctagonAlert, row: "bg-over/10 text-over" },
  "near-limit": { icon: AlertTriangle, row: "bg-warn/10 text-warn" },
  "fully-used": { icon: Check, row: "text-foreground" },
};

/** Budget trouble spots, each linking to that category's transactions. Hidden when all is well. */
export function NeedsAttention({ month, className }: { month: string; className?: string }) {
  const status = useBudgetStatus(month).data;
  const items = status ? buildAttention(status.categories, status.days_left) : [];
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="needs-attention"
      className={cn("rounded-2xl border bg-card p-5", className)}
    >
      <h2 id="needs-attention" className="text-base font-semibold">
        Needs attention
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map(({ kind, categoryId, lead, rest }) => {
          const { icon: Icon, row } = STYLE[kind];
          return (
            <li key={categoryId}>
              <Link
                to={`/transactions?month=${month}&category_id=${categoryId}`}
                className={cn(
                  "flex min-h-11 items-start gap-2.5 rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  row,
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <b className="font-semibold">{lead}</b>
                  {rest}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
