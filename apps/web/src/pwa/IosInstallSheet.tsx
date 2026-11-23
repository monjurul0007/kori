import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useIosHelp } from "./useInstallPrompt";

export function IosInstallSheet() {
  const { open, setOpen } = useIosHelp();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Kori</DialogTitle>
          <DialogDescription>Add Kori to your home screen to use it like an app.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Tap Share, then Add to Home Screen.</li>
          <li>Leave &ldquo;Open as Web App&rdquo; on.</li>
          <li>Tap Add.</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
