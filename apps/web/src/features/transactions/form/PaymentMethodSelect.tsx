interface Props {
  id: string;
  methods: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function PaymentMethodSelect({ id, methods, value, onChange }: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
    >
      <option value="">None</option>
      {methods.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
