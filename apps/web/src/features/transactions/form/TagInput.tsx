import { X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

interface Props {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  known: string[];
  /** Reports text typed but not yet turned into a tag, so a parent can commit it on submit. */
  onPendingChange?: (text: string) => void;
}

/** Add `raw` to `tags`: trims, strips a leading #, ignores blanks and case-insensitive duplicates. */
export function withTag(tags: string[], raw: string): string[] {
  const tag = raw.trim().replace(/^#/, "");
  if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}

export function TagInput({ id, value, onChange, known, onPendingChange }: Props) {
  const [text, setTextState] = useState("");
  const setText = (next: string) => {
    setTextState(next);
    onPendingChange?.(next);
  };
  const query = text.trim().replace(/^#/, "").toLowerCase();
  const suggestions = query
    ? known.filter((t) => t.toLowerCase().startsWith(query) && !value.includes(t)).slice(0, 5)
    : [];

  const add = (raw: string) => {
    const next = withTag(value, raw);
    if (next !== value) onChange(next);
    setText("");
  };

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={text}
        placeholder="Type a tag, press Enter"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => add(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // Enter adds a tag; it must not submit the form.
            add(text);
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul aria-label="Tag suggestions" className="flex flex-wrap gap-2">
          {suggestions.map((t) => (
            <li key={t}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus, so blur doesn't add the half-typed text
                onClick={() => add(t)}
                className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
              >
                #{t}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul aria-label="Selected tags" className="flex flex-wrap gap-2">
          {value.map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded-full p-1 hover:bg-background"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
