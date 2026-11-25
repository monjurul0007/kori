import { Plus } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { navItems } from "./nav";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
    isActive ? "font-semibold text-brand-text" : "text-muted-foreground",
  );

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const [first, ...rest] = navItems;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t bg-surface px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
    >
      {[first, null, ...rest].map((item) =>
        item ? (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ) : (
          <button
            key="add"
            type="button"
            onClick={onAdd}
            aria-label="Add transaction"
            className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-[19px] bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_hsl(var(--primary))] transition-colors duration-150 hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:ring-offset-2"
          >
            <Plus className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
          </button>
        ),
      )}
    </nav>
  );
}
