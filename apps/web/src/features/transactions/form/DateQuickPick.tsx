import { Input } from "@/components/ui/input";
import { addDays, todayInDhaka } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  describedBy?: string;
}

export function DateQuickPick({ id, value, onChange, describedBy }: Props) {
  const today = todayInDhaka();
  const yesterday = addDays(today, -1);
  const pill = (active: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3 text-sm",
      active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={pill(value === today)} onClick={() => onChange(today)}>
        Today
      </button>
      <button
        type="button"
        className={pill(value === yesterday)}
        onClick={() => onChange(yesterday)}
      >
        Yesterday
      </button>
      <Input
        id={id}
        type="date"
        value={value}
        max={today}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto"
      />
    </div>
  );
}
