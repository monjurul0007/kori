import { formatTaka, fromPoisha, toPoisha } from "@/lib/money";

interface Props {
  expense: string;
  income: string;
}

export function TotalsBar({ expense, income }: Props) {
  const items = [
    { label: "Spent", value: formatTaka(expense), className: "" },
    { label: "Income", value: formatTaka(income), className: "text-emerald-600" },
    {
      label: "Net",
      value: formatTaka(fromPoisha(toPoisha(income) - toPoisha(expense))),
      className: "",
    },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-3 text-center">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={`text-sm font-semibold ${item.className}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
