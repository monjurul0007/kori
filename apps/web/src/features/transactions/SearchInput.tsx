import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  delayMs?: number;
}

export function SearchInput({ value, onChange, delayMs = 300 }: Props) {
  const [text, setText] = useState(value);

  // Follow the URL when it changes elsewhere (back button), adjusted during render.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, value, onChange, delayMs]);

  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label="Search transactions"
        placeholder="Search merchant or note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
