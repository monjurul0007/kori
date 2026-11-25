import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

type CardTitleLevel = "h2" | "h3";

/** Defaults to h2 so a card follows the page h1; pass `as="h3"` when the card sits under an h2. */
export function CardTitle({
  as: Heading = "h2",
  className,
  children,
  ...props
}: React.ComponentProps<"h2"> & { as?: CardTitleLevel }) {
  return (
    <Heading className={cn("text-lg font-semibold leading-none", className)} {...props}>
      {children}
    </Heading>
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
