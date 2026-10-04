import { Plus } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navItems } from "./nav";

export function SideNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex"
    >
      <p className="px-3 py-2 text-lg font-semibold">Kori · কড়ি</p>
      <Button onClick={onAdd} className="mb-2 h-11 justify-start">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add transaction
      </Button>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted",
            )
          }
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
