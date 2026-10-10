import { useState } from "react";

import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  describedBy?: string;
}

const TOP = 8;

const chip = (active: boolean) =>
  cn(
    "min-h-9 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
  );

export function CategoryChips({ categories, value, onChange, describedBy }: Props) {
  const [all, setAll] = useState(false);
  const selected = categories.findIndex((c) => c.id === value);
  // Keep an already-chosen category visible even when it's beyond the top few.
  const shown =
    all || categories.length <= TOP
      ? categories
      : categories.filter((_c, i) => i < TOP || i === selected);
  return (
    <div role="radiogroup" aria-label="Category" aria-describedby={describedBy}>
      <div className="flex flex-wrap gap-2">
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === value}
            onClick={() => onChange(c.id)}
            className={chip(c.id === value)}
          >
            {c.name}
          </button>
        ))}
        {!all && categories.length > shown.length && (
          <button type="button" onClick={() => setAll(true)} className={chip(false)}>
            More…
          </button>
        )}
      </div>
    </div>
  );
}
