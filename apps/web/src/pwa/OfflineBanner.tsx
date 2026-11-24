import { WifiOff } from "lucide-react";

import { OFFLINE_MESSAGE, useOnline } from "./useOnline";

export function OfflineBanner() {
  if (useOnline()) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-start gap-2 bg-warn/10 px-4 py-2 text-sm text-warn"
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {OFFLINE_MESSAGE}
    </div>
  );
}
