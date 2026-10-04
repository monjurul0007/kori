import { Plus } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { navItems } from "./nav";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "font-semibold text-primary" : "text-muted-foreground",
  );

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const [first, ...rest] = navItems;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t bg-background px-2 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden"
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
            className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
          </button>
        ),
      )}
    </nav>
  );
}
