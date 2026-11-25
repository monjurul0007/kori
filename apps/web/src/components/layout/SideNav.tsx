import { Plus } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navItems } from "./nav";

export function SideNav({ onAdd }: { onAdd: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1.5 border-r bg-surface px-3.5 py-[18px] md:flex">
      <Wordmark showBangla={false} className="px-1.5 pb-3.5 pt-0.5 text-[19px]" />
      <Button onClick={onAdd} className="mb-1.5 h-11 w-full rounded-[11px] font-semibold">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add expense
      </Button>
      <nav aria-label="Main" className="flex flex-col gap-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                isActive
                  ? "bg-brand-soft font-semibold text-brand-text"
                  : "font-medium text-muted-foreground hover:bg-muted",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <p className="mt-auto flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
        Works offline
      </p>
    </aside>
  );
}
