import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface Props extends Omit<React.ComponentProps<"span">, "children"> {
  label: string;
  onRemove: () => void;
  /** Start of the remove button's accessible name; the label follows it. */
  removeLabel?: string;
}

/** A chip with a remove button whose hit area is at least 32px. */
export function RemovableChip({
  label,
  onRemove,
  removeLabel = "Remove tag",
  className,
  ...props
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-3 pr-0.5 text-xs text-brand-text",
        className,
      )}
      {...props}
    >
      {label}
      <button
        type="button"
        aria-label={`${removeLabel} ${label}`}
        onClick={onRemove}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}
