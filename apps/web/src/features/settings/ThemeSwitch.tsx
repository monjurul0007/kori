import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { THEME_PREFERENCES, useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: "System", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
};

/** Segmented System / Light / Dark control, built on radio inputs so the keyboard works for free. */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-1 rounded-[10px] border bg-muted p-1"
    >
      {THEME_PREFERENCES.map((option) => {
        const { label, icon: Icon } = OPTIONS[option];
        return (
          <label key={option} className="relative">
            <input
              type="radio"
              name="theme"
              value={option}
              checked={preference === option}
              onChange={() => setPreference(option)}
              className="peer sr-only"
            />
            <span className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-3 text-sm font-medium text-muted-foreground transition-colors peer-checked:bg-card peer-checked:font-semibold peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
