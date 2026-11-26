import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  confirmLabel: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The sheet footer while a destructive action waits for a yes. Cancel has focus, so Enter is safe. */
export function ConfirmFooter({ confirmLabel, isPending, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <>
      <Button type="button" variant="outline" className="h-12" ref={cancelRef} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" className="h-12 flex-1" disabled={isPending} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </>
  );
}
