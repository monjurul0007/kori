import { X } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { normalizeTagName, suggestTags, withTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  known: string[];
  /** Reports text typed but not yet turned into a tag, so a parent can commit it on submit. */
  onPendingChange?: (text: string) => void;
}

const NO_ACTIVE_OPTION = -1;

interface TagOption {
  tag: string;
  isNew: boolean;
}

/** Existing matches first, then a "Create" option when the text isn't already a known tag. */
function buildOptions(known: string[], chosen: string[], text: string): TagOption[] {
  const matches = suggestTags(known, chosen, text).map((tag) => ({ tag, isNew: false }));
  const typed = normalizeTagName(text);
  const isTypedTagTaken = !typed || known.includes(typed) || chosen.includes(typed);
  return isTypedTagTaken ? matches : [...matches, { tag: typed, isNew: true }];
}

export function TagInput({ id, value, onChange, known, onPendingChange }: Props) {
  const listboxId = useId();
  const [text, setTextState] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_OPTION);
  const options = buildOptions(known, value, text);
  const isListboxVisible = isOpen && options.length > 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const setText = (next: string) => {
    setTextState(next);
    setActiveIndex(NO_ACTIVE_OPTION);
    onPendingChange?.(next);
  };

  const add = (raw: string) => {
    const next = withTag(value, raw);
    if (next !== value) onChange(next);
    setText("");
    setIsOpen(false);
  };

  const moveActive = (step: 1 | -1) => {
    setIsOpen(true);
    if (options.length === 0) return;
    setActiveIndex((current) => (current + step + options.length) % options.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault(); // Enter picks a tag; it must not submit the form.
      const active = isListboxVisible ? options[activeIndex] : undefined;
      add(active ? active.tag : text);
    } else if (e.key === "Escape" && isListboxVisible) {
      e.stopPropagation(); // close the list, not the sheet around it
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={isListboxVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isListboxVisible && activeIndex !== NO_ACTIVE_OPTION ? optionId(activeIndex) : undefined
          }
          value={text}
          placeholder="Type a tag, press Enter"
          onChange={(e) => {
            setText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => add(text)}
          onKeyDown={handleKeyDown}
        />
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          hidden={!isListboxVisible}
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {options.map((option, index) => (
            <li
              key={option.tag}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus, so blur doesn't add the half-typed text
                add(option.tag);
              }}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm hover:bg-muted",
                index === activeIndex && "bg-muted",
              )}
            >
              {option.isNew ? `Create "${option.tag}"` : option.tag}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Tags are saved in lowercase; spaces become hyphens.
      </p>
      {value.length > 0 && (
        <ul aria-label="Selected tags" className="flex flex-wrap gap-2">
          {value.map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft pl-3 text-xs text-brand-text"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
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
