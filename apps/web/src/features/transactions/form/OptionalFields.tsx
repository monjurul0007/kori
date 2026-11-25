import { CalendarDays, Wallet, TextCursorInput } from "lucide-react";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, formatDisplayDate, todayInDhaka } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { DateQuickPick } from "./DateQuickPick";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

type Field = "date" | "method" | "merchant";

interface Props {
  idPrefix: string;
  isDesktop: boolean;
  date: string;
  onDateChange: (iso: string) => void;
  methods: { id: string; name: string }[];
  methodId: string;
  onMethodChange: (id: string) => void;
  merchant: UseFormRegisterReturn;
  merchantText: string;
  errors: { date?: React.ReactNode; merchant?: React.ReactNode };
  /** The id of the date error message, so the date input can point at it. */
  dateErrorId?: string;
}

function dateLabel(iso: string): string {
  const today = todayInDhaka();
  if (iso === today) return "Today";
  return iso === addDays(today, -1) ? "Yesterday" : formatDisplayDate(iso);
}

function ChipButton({
  icon: Icon,
  label,
  isOpen,
  onClick,
}: {
  icon: typeof CalendarDays;
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        isOpen && "bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Date, paid-with and merchant: shown directly on desktop, as chips that open on a phone. */
export function OptionalFields(props: Props) {
  const { idPrefix, isDesktop, date, methods, methodId, merchant, merchantText, errors } = props;
  const [open, setOpen] = useState<Field>();
  const toggle = (field: Field) => setOpen((current) => (current === field ? undefined : field));
  const dateControl = (
    <DateQuickPick
      id={`${idPrefix}-date`}
      value={date}
      onChange={props.onDateChange}
      describedBy={props.dateErrorId}
    />
  );
  const methodControl = (
    <PaymentMethodSelect
      id={`${idPrefix}-method`}
      methods={methods}
      value={methodId}
      onChange={props.onMethodChange}
    />
  );
  const merchantControl = <Input id={`${idPrefix}-merchant`} {...merchant} />;

  if (isDesktop) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          {dateControl}
          {errors.date}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-merchant`}>Merchant</Label>
          {merchantControl}
          {errors.merchant}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-method`}>Paid with</Label>
          {methodControl}
        </div>
      </div>
    );
  }
  const methodName = methods.find((m) => m.id === methodId)?.name ?? "Paid with";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ChipButton
          icon={CalendarDays}
          label={dateLabel(date)}
          isOpen={open === "date"}
          onClick={() => toggle("date")}
        />
        <ChipButton
          icon={Wallet}
          label={methodName}
          isOpen={open === "method"}
          onClick={() => toggle("method")}
        />
        <ChipButton
          icon={TextCursorInput}
          label={merchantText.trim() || "Merchant"}
          isOpen={open === "merchant"}
          onClick={() => toggle("merchant")}
        />
      </div>
      {open === "date" && (
        <div>
          <Label htmlFor={`${idPrefix}-date`} className="sr-only">
            Date
          </Label>
          {dateControl}
        </div>
      )}
      {open === "method" && (
        <div>
          <Label htmlFor={`${idPrefix}-method`} className="sr-only">
            Paid with
          </Label>
          {methodControl}
        </div>
      )}
      {open === "merchant" && (
        <div>
          <Label htmlFor={`${idPrefix}-merchant`} className="sr-only">
            Merchant
          </Label>
          {merchantControl}
        </div>
      )}
      {errors.date}
      {errors.merchant}
    </div>
  );
}
