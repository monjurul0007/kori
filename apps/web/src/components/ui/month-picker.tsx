import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { IconButton } from "@/components/ui/icon-button";
import {
  addMonths,
  formatMonth,
  formatMonthShort,
  monthOf,
  shortMonthName,
  todayInDhaka,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  /** `YYYY-MM` */
  month: string;
  onChange: (month: string) => void;
}

const MONTHS_PER_YEAR = 12;
const MONTHS_PER_ROW = 3;

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -MONTHS_PER_ROW,
  ArrowDown: MONTHS_PER_ROW,
};

const monthsOfYear = (year: number): string[] =>
  Array.from(
    { length: MONTHS_PER_YEAR },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );

const yearOf = (month: string): number => Number(month.slice(0, 4));

const pillClass = "inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5";

/**
 * A month pill with previous and next buttons and a popover for jumping to any past month.
 * Months after the current Dhaka month can't be picked: nothing can be added there yet.
 */
export function MonthPicker({ month, onChange }: MonthPickerProps) {
  const currentMonth = monthOf(todayInDhaka());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const { target } = event;
      if (target instanceof Node && !containerRef.current?.contains(target)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const pick = (picked: string) => {
    onChange(picked);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={pillClass}>
        <IconButton
          aria-label="Previous month"
          className="rounded-full"
          onClick={() => onChange(addMonths(month, -1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <button
          ref={triggerRef}
          type="button"
          aria-label={formatMonth(month)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? dialogId : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 [@media(pointer:coarse)]:h-11"
        >
          <span aria-hidden="true" className="hidden sm:inline">
            {formatMonth(month)}
          </span>
          <span aria-hidden="true" className="sm:hidden">
            {formatMonthShort(month)}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground sm:hidden" aria-hidden="true" />
        </button>
        <IconButton
          aria-label="Next month"
          className="rounded-full"
          disabled={month >= currentMonth}
          onClick={() => onChange(addMonths(month, 1))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
      {isOpen && (
        <MonthGridDialog id={dialogId} month={month} currentMonth={currentMonth} onPick={pick} />
      )}
    </div>
  );
}

interface MonthGridDialogProps {
  id: string;
  month: string;
  currentMonth: string;
  onPick: (month: string) => void;
}

function MonthGridDialog({ id, month, currentMonth, onPick }: MonthGridDialogProps) {
  // A future ?month= can still arrive by URL; start on the latest month that can be picked.
  const startMonth = month > currentMonth ? currentMonth : month;
  const [viewYear, setViewYear] = useState(yearOf(startMonth));
  const [focused, setFocused] = useState(startMonth);
  const gridRef = useRef<HTMLDivElement>(null);
  const months = monthsOfYear(viewYear);
  const isInGrid = months.includes(focused);
  const tabStop = isInGrid ? focused : (months.find((m) => m <= currentMonth) ?? `${viewYear}-01`);

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>("button[tabindex='0']")?.focus();
    // Focus the selected month once, when the dialog opens.
  }, []);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const target = months[months.indexOf(tabStop) + step];
    if (!target || target > currentMonth) return;
    setFocused(target);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-month='${target}']`)?.focus();
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Choose month"
      className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border bg-card p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <IconButton aria-label="Previous year" onClick={() => setViewYear(viewYear - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <span aria-live="polite" className="text-sm font-semibold">
          {viewYear}
        </span>
        <IconButton
          aria-label="Next year"
          disabled={viewYear >= yearOf(currentMonth)}
          onClick={() => setViewYear(viewYear + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
      <div
        ref={gridRef}
        role="group"
        aria-label={`Months of ${viewYear}`}
        className="grid grid-cols-3 gap-1"
      >
        {months.map((value) => {
          const isSelected = value === month;
          return (
            <button
              key={value}
              type="button"
              data-month={value}
              tabIndex={value === tabStop ? 0 : -1}
              disabled={value > currentMonth}
              aria-label={formatMonth(value)}
              aria-pressed={isSelected}
              aria-current={value === currentMonth ? "date" : undefined}
              onClick={() => onPick(value)}
              onKeyDown={moveFocus}
              className={cn(
                "h-11 rounded-lg text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-40",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                value === currentMonth && !isSelected && "border border-primary/40",
              )}
            >
              <span aria-hidden="true">{shortMonthName(value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
