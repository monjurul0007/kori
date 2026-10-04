import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Placeholder: M1-14 puts the fast-add form in here. */
export function AddTransactionSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
          <SheetDescription>The quick-add form arrives in the next update.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
