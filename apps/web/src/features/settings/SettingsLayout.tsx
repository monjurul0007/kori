import { NavLink, Outlet } from "react-router-dom";

import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

import { SETTINGS_SECTIONS } from "./sections";

/** On desktop every settings page sits beside a sub-menu; phones show the page alone. */
export function SettingsLayout() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  if (!isDesktop) return <Outlet />;

  return (
    <div className="grid grid-cols-[13rem_minmax(0,1fr)] gap-8">
      <nav aria-label="Settings sections" className="flex flex-col gap-1 pt-12">
        {SETTINGS_SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center rounded-[10px] border-l-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                isActive
                  ? "border-primary bg-card font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted",
              )
            }
          >
            {section.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
