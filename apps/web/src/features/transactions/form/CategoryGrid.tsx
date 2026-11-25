import { Ellipsis } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

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

interface TileProps {
  label: string;
  color: string | null;
  onClick: () => void;
  children: React.ReactNode;
  /** Present for a radio tile, which also takes part in the roving tabindex. */
  radio?: {
    selected: boolean;
    tabIndex: 0 | -1;
    ref: (node: HTMLButtonElement | null) => void;
    onKeyDown: (event: KeyboardEvent) => void;
  };
}

function Tile({ label, color, onClick, children, radio }: TileProps) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio?.selected}
      tabIndex={radio?.tabIndex}
      ref={radio?.ref}
      onKeyDown={radio?.onKeyDown}
      onClick={onClick}
      className="group flex min-h-11 flex-col items-center gap-1.5 rounded-lg text-xs focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-transparent bg-muted group-focus-visible:ring-[3px] group-focus-visible:ring-ring/25",
          radio?.selected && "border-current",
        )}
        style={color ? { backgroundColor: `${color}${TILE_TINT}`, color } : undefined}
      >
        {children}
      </span>
      <span
        className={cn(
          "max-w-full truncate",
          radio?.selected ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

const STEP_BY_KEY: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Four tiles per row: the seven most-used categories, then "More" for the rest. */
export function CategoryGrid({ categories, value, onChange, describedBy }: Props) {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasMore = categories.length > COLLAPSED_COUNT;
  const isCollapsed = hasMore && !isShowingAll;
  // A chosen category stays visible even when it is beyond the first seven.
  const shown = isCollapsed
    ? categories.filter((c, i) => i < COLLAPSED_COUNT || c.id === value)
    : categories;
  // One Tab stop: the chosen tile, or the first when nothing is chosen yet.
  const selectedIndex = shown.findIndex((c) => c.id === value);
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = STEP_BY_KEY[event.key];
    if (!step) return;
    event.preventDefault();
    const current = tileRefs.current.findIndex((node) => node === document.activeElement);
    const next = (Math.max(current, 0) + step + shown.length) % shown.length;
    const target = shown[next];
    if (!target) return;
    onChange(target.id);
    tileRefs.current[next]?.focus();
  };

  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3">
      {/* "contents" keeps the tiles in the outer grid; "More" stays outside the radiogroup. */}
      <div
        role="radiogroup"
        aria-label="Category"
        aria-describedby={describedBy}
        className="contents"
      >
        {shown.map((c, index) => (
          <Tile
            key={c.id}
            label={c.name}
            color={c.color}
            onClick={() => onChange(c.id)}
            radio={{
              selected: c.id === value,
              tabIndex: index === tabStopIndex ? 0 : -1,
              onKeyDown: handleKeyDown,
              ref: (node) => {
                tileRefs.current[index] = node;
              },
            }}
          >
            <CategoryIcon icon={c.icon} color={c.color} />
          </Tile>
        ))}
      </div>
      {isCollapsed && (
        <Tile label="More" color={null} onClick={() => setIsShowingAll(true)}>
          <Ellipsis className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Tile>
      )}
    </div>
  );
}
