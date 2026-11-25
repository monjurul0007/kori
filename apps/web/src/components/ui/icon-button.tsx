import * as React from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<React.ComponentProps<"button">, "aria-label"> {
  /** Required: an icon alone has no name for screen readers. */
  "aria-label": string;
}

/** A 40px hit area on desktop and 44px on touch screens, with a visible focus ring. */
export function IconButton({ className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        className,
      )}
      {...props}
    />
  );
}
