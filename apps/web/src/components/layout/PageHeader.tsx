import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { iconButtonClass } from "@/components/ui/icon-button";
import { formatMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/usePageTitle";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  /** Parent page; shows a back button before the title and is appended to the tab title. */
  backTo?: { label: string; to: string };
  /** `YYYY-MM` for month-scoped pages; it is added to the tab title. */
  month?: string;
}

function tabTitle({ title, backTo, month }: PageHeaderProps): string {
  if (backTo) return `${title} · ${backTo.label}`;
  if (month) return `${title} · ${formatMonth(month)}`;
  return title;
}

export function PageHeader(props: PageHeaderProps) {
  const { title, actions, backTo } = props;
  usePageTitle(tabTitle(props));
  return (
    <header className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {backTo && (
          <Link
            to={backTo.to}
            aria-label={`Back to ${backTo.label}`}
            className={cn(iconButtonClass, "-ml-2 h-11 w-11 text-foreground")}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <h1
          tabIndex={-1}
          className="font-display text-xl font-semibold [font-stretch:106%] focus:outline-none md:text-2xl"
        >
          {title}
        </h1>
      </div>
      {actions}
    </header>
  );
}
