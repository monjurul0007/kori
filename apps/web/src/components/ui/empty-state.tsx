import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Inbox, SearchX, type LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const ICON_FOR_VARIANT = { empty: Inbox, "no-results": SearchX, error: AlertCircle } as const;

const emptyStateVariants = cva("mb-3 h-8 w-8", {
  variants: {
    variant: {
      empty: "text-brand-text",
      "no-results": "text-muted-foreground",
      error: "text-over",
    },
  },
  defaultVariants: { variant: "empty" },
});

interface Props
  extends Omit<React.ComponentProps<"div">, "title">, VariantProps<typeof emptyStateVariants> {
  /** One sentence that says what this is, or what went wrong. */
  message: string;
  /** The one next step, usually a button or link. */
  action?: React.ReactNode;
  icon?: LucideIcon;
}

export function EmptyState({
  message,
  action,
  icon,
  variant = "empty",
  className,
  ...props
}: Props) {
  const Icon = icon ?? ICON_FOR_VARIANT[variant ?? "empty"];
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center px-6 py-10 text-center", className)}
      {...props}
    >
      <Icon className={emptyStateVariants({ variant })} aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
