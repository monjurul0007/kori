import * as React from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

interface Props {
  label: string;
  hint?: string;
  /** The message to show, or nothing when the field is fine. */
  error?: string;
  className?: string;
  /** Spread the given props on the control so the label, hint and error are wired to it. */
  children: (control: FieldControlProps) => React.ReactNode;
}

export function Field({ label, hint, error, className, children }: Props) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-over">
          {error}
        </p>
      ) : null}
    </div>
  );
}
