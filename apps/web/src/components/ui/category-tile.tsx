import { CategoryIcon } from "@/features/settings/categoryStyle";
import { cn } from "@/lib/utils";

interface Props {
  icon: string | null;
  color: string | null;
  className?: string;
}

/** A rounded square with the category's icon on a faint wash of its colour. */
export function CategoryTile({ icon, color, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-muted", className)}
      style={
        color ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined
      }
    >
      <CategoryIcon icon={icon} color={color} />
    </span>
  );
}
