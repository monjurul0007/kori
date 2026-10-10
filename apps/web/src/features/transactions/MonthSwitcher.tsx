import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addMonths, formatMonth } from "@/lib/dates";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSwitcher({ month, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </Button>
      <label className="relative flex-1 text-center">
        <span className="text-base font-semibold">{formatMonth(month)}</span>
        {/* Tap the title to pick any month with the device's own picker. */}
        <input
          type="month"
          aria-label="Pick month"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next month"
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
