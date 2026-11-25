import * as React from "react";

import { Button } from "./button";

interface Props {
  /** What would be lost, in the page's words: "Discard this transaction?" */
  title: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/** The "Discard changes?" confirm that covers a form sheet whose input would be lost. */
export function DiscardPrompt({ title, onKeepEditing, onDiscard }: Props) {
  const keepEditingRef = React.useRef<HTMLButtonElement>(null);
  // The safe choice gets focus first, so Enter never discards by accident.
  React.useEffect(() => keepEditingRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-label={title}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6"
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-4 shadow-lg">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">What you typed will be lost.</p>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" ref={keepEditingRef} onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
