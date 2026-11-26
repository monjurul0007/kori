import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { toastError, toastSuccess } from "@/lib/toast";

import { planMove, type OrderPatch } from "./reorder";
import { ReferenceEditSheet } from "./ReferenceEditSheet";

export interface ListItem {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

interface Props<I extends ListItem, E> {
  /** Singular, lower case: "category", "payment method". */
  noun: string;
  /** The API's name length limit. */
  maxNameLength: number;
  items: I[];
  /** Extra fields of the add/edit sheet, and their starting value. */
  initialExtra: (item?: I) => E;
  extraFields?: (value: E, set: (value: E) => void) => ReactNode;
  /** Shown before the name (an icon). */
  leading?: (item: I) => ReactNode;
  /** Secondary text under or beside the name: a month's spend, a kind. */
  detail?: (item: I) => ReactNode;
  onSave: (input: { item?: I; name: string; extra: E }) => Promise<unknown>;
  onMove: (patches: OrderPatch[]) => void;
  onArchive: (item: I, archive: boolean) => Promise<unknown>;
}

const rowClass = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

export function ReferenceListEditor<I extends ListItem, E>({
  noun,
  maxNameLength,
  items,
  initialExtra,
  extraFields,
  leading,
  detail,
  onSave,
  onMove,
  onArchive,
}: Props<I, E>) {
  const [showArchived, setShowArchived] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [editing, setEditing] = useState<{ item?: I } | null>(null);

  const active = items.filter((i) => !i.archived_at).sort((a, b) => a.sort_order - b.sort_order);
  const archived = items.filter((i) => i.archived_at);

  const rowBody = (item: I) => (
    <>
      {leading?.(item)}
      <span className="min-w-0 flex-1 break-words">{item.name}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail(item)}</span>}
    </>
  );

  async function archive(item: I) {
    await onArchive(item, true);
    toastSuccess(`Archived ${item.name}`, {
      undo: () => onArchive(item, false).then(() => undefined, toastError),
    });
  }

  async function save(input: { item?: I; name: string; extra: E }) {
    await onSave(input);
    toastSuccess(input.item ? "Saved changes" : `Added ${input.name}`);
  }

  return (
    <div>
      <ul className="divide-y rounded-lg border bg-card">
        {active.map((item, index) => (
          <li key={item.id}>
            {isReordering ? (
              <div className={rowClass}>
                <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {rowBody(item)}
                <IconButton
                  aria-label={`Move ${item.name} up`}
                  disabled={index === 0}
                  onClick={() => onMove(planMove(active, index, -1))}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  aria-label={`Move ${item.name} down`}
                  disabled={index === active.length - 1}
                  onClick={() => onMove(planMove(active, index, 1))}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Edit ${item.name}`}
                className={`${rowClass} hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25`}
                onClick={() => setEditing({ item })}
              >
                {rowBody(item)}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {active.length === 0 && (
          <li className="px-4 py-4 text-sm text-muted-foreground">No {noun}s yet.</li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button className="h-11" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add {noun}
          </Button>
          {active.length > 1 && (
            <Button variant="outline" className="h-11" onClick={() => setIsReordering((on) => !on)}>
              {isReordering ? "Done" : "Reorder"}
            </Button>
          )}
        </div>
        {archived.length > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived ({archived.length})
          </label>
        )}
      </div>

      {showArchived && archived.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border bg-card text-muted-foreground">
          {archived.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              {leading?.(item)}
              <span className="min-w-0 flex-1 break-words">{item.name}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-11"
                aria-label={`Unarchive ${item.name}`}
                onClick={() =>
                  onArchive(item, false)
                    .then(() => toastSuccess(`Unarchived ${item.name}`))
                    .catch(toastError)
                }
              >
                Unarchive
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ReferenceEditSheet
          // A new key resets the form for each item.
          key={editing.item?.id ?? "new"}
          noun={noun}
          maxNameLength={maxNameLength}
          item={editing.item}
          initialExtra={initialExtra}
          extraFields={extraFields}
          onSave={save}
          onArchive={archive}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
