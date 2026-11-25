import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { DeleteFlow } from "./useDeleteFlow";

const DANGER_BUTTON = "border-border bg-surface text-over hover:bg-muted";

interface DeleteButtonProps {
  buttonRef: React.Ref<HTMLButtonElement>;
  isPending: boolean;
  onClick: () => void;
  className?: string;
}

export function DeleteButton({ buttonRef, isPending, onClick, className }: DeleteButtonProps) {
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={onClick}
      className={cn(DANGER_BUTTON, className)}
    >
      Delete
    </Button>
  );
}

/** The inline "are you sure?" step. Cancel is the safe choice, so it gets focus first. */
export function DeleteConfirm({ flow }: { flow: DeleteFlow }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-label="Confirm delete"
      aria-busy={flow.isPending}
      className="space-y-2 rounded-md border border-over p-3"
    >
      <p className="text-sm">Delete this transaction? This can&apos;t be undone.</p>
      <div className="flex gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          disabled={flow.isPending}
          onClick={flow.cancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-over text-primary-foreground hover:bg-over/90"
          disabled={flow.isPending}
          onClick={() => void flow.confirm()}
        >
          {flow.isPending ? "Deleting…" : "Confirm delete"}
        </Button>
      </div>
    </div>
  );
}
