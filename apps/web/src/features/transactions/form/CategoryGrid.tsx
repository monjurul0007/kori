import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "@/features/settings/categoryStyle";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Props {
  /** Already ranked, most-used first. */
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  describedBy?: string;
}

const COLLAPSED_COUNT = 7;
const TILE_TINT = "1f"; // hex alpha, about 12%

function Tile({
  label,
  selected,
  color,
  onClick,
  role,
  children,
}: {
  label: string;
  selected?: boolean;
  color: string | null;
  onClick: () => void;
  role?: "radio";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? !!selected : undefined}
      onClick={onClick}
      className="group flex min-h-11 flex-col items-center gap-1.5 rounded-lg text-xs focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-transparent bg-muted group-focus-visible:ring-[3px] group-focus-visible:ring-ring/25",
          selected && "border-current",
        )}
        style={color ? { backgroundColor: `${color}${TILE_TINT}`, color } : undefined}
      >
        {children}
      </span>
      <span
        className={cn("max-w-full truncate", selected ? "font-semibold" : "text-muted-foreground")}
      >
        {label}
      </span>
    </button>
  );
}

/** Four tiles per row: the seven most-used categories, then "More" for the rest. */
export function CategoryGrid({ categories, value, onChange, describedBy }: Props) {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const hasMore = categories.length > COLLAPSED_COUNT;
  const isCollapsed = hasMore && !isShowingAll;
  // A chosen category stays visible even when it is beyond the first seven.
  const shown = isCollapsed
    ? categories.filter((c, i) => i < COLLAPSED_COUNT || c.id === value)
    : categories;
  return (
    <div
      role="radiogroup"
      aria-label="Category"
      aria-describedby={describedBy}
      className="grid grid-cols-4 gap-x-2 gap-y-3"
    >
      {shown.map((c) => (
        <Tile
          key={c.id}
          role="radio"
          label={c.name}
          color={c.color}
          selected={c.id === value}
          onClick={() => onChange(c.id)}
        >
          <CategoryIcon icon={c.icon} color={c.color} />
        </Tile>
      ))}
      {isCollapsed && (
        <Tile label="More" color={null} onClick={() => setIsShowingAll(true)}>
          <Ellipsis className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Tile>
      )}
    </div>
  );
}
