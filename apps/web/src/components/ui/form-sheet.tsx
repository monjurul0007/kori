import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { DiscardPrompt } from "./discard-prompt";
import { IconButton } from "./icon-button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Read by screen readers only. */
  description: string;
  /** Unsaved input: closing then asks "Discard changes?" first. */
  dirty?: boolean;
  /** Runs before the sheet's own Esc handling; call `preventDefault` to claim the key. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** The sticky actions row, always visible, e.g. a Save button. */
  footer: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const DISCARD_TITLE = "Discard changes?";

/**
 * Full-height sheet on phones, a right-hand panel (max 420px) from 768px up. The body scrolls
 * and the footer stays put. Esc, the overlay and × all go through the discard guard.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  dirty = false,
  onEscapeKeyDown,
  footer,
  children,
  className,
}: Props) {
  const [isConfirmingDiscard, setIsConfirmingDiscard] = React.useState(false);
  const focusBeforePromptRef = React.useRef<HTMLElement | null>(null);

  // A parent can close the sheet (a finished save); the next open must not show a stale prompt.
  // Adjusting state while rendering is React's way to reset state when a prop changes.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setIsConfirmingDiscard(false);
  }

  const close = () => {
    setIsConfirmingDiscard(false);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (dirty) {
      focusBeforePromptRef.current = document.activeElement as HTMLElement | null;
      return setIsConfirmingDiscard(true);
    }
    close();
  };

  const keepEditing = () => {
    setIsConfirmingDiscard(false);
    // The prompt took focus; hand it back to where the person was typing.
    focusBeforePromptRef.current?.focus();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(event) => {
            onEscapeKeyDown?.(event);
            if (event.defaultPrevented) return;
            // Esc backs out of the discard prompt instead of closing the sheet.
            if (!isConfirmingDiscard) return;
            event.preventDefault();
            setIsConfirmingDiscard(false);
          }}
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-surface shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out md:left-auto md:w-full md:max-w-[420px] md:border-l md:border-border md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
            className,
          )}
        >
          <header className="flex items-center justify-between py-3 pl-5 pr-2">
            <DialogPrimitive.Title className="font-display text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          <footer className="flex gap-2.5 border-t border-border px-5 pb-4 pt-3">{footer}</footer>
          {isConfirmingDiscard && (
            <DiscardPrompt title={DISCARD_TITLE} onKeepEditing={keepEditing} onDiscard={close} />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
