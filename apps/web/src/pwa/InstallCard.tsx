import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useInstallPrompt } from "./useInstallPrompt";

/** Dismissible dashboard card. Dismissal is remembered for 30 days. */
export function InstallCard() {
  const install = useInstallPrompt();
  if (!install.canPrompt || install.dismissed) return null;
  return (
    <Card className="flex items-center gap-3 p-3 md:col-span-2">
      <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm">Install Kori on your phone for quick access.</p>
      <Button className="h-11" onClick={() => void install.prompt()}>
        Install Kori
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        aria-label="Dismiss install suggestion"
        onClick={install.dismiss}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
