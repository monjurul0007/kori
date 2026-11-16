import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toastError } from "@/lib/toast";

import { planMove, type OrderPatch } from "./reorder";

export interface ListItem {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

interface Props<I extends ListItem, E> {
  /** Singular, lower case: "category", "payment method". */
  noun: string;
  items: I[];
  /** Extra fields of the add/rename sheet, and their starting value. */
  initialExtra: (item?: I) => E;
  extraFields?: (value: E, set: (value: E) => void) => ReactNode;
  /** Shown before the name (an icon) and after it (a kind). */
  leading?: (item: I) => ReactNode;
  detail?: (item: I) => string;
  onSave: (input: { item?: I; name: string; extra: E }) => Promise<unknown>;
  onMove: (patches: OrderPatch[]) => void;
  onArchive: (item: I, archive: boolean) => Promise<unknown>;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ReferenceListEditor<I extends ListItem, E>({
  noun,
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
  const [editing, setEditing] = useState<{ item?: I } | null>(null);
  const [archiving, setArchiving] = useState<I | null>(null);

  const active = items.filter((i) => !i.archived_at).sort((a, b) => a.sort_order - b.sort_order);
  const archived = items.filter((i) => i.archived_at);

  return (
    <div>
      <ul className="divide-y rounded-md border">
        {active.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2">
            {leading?.(item)}
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {detail && <span className="text-xs text-muted-foreground">{detail(item)}</span>}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${item.name} up`}
              disabled={index === 0}
              onClick={() => onMove(planMove(active, index, -1))}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${item.name} down`}
              disabled={index === active.length - 1}
              onClick={() => onMove(planMove(active, index, 1))}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${item.name}`}
              onClick={() => setEditing({ item })}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Archive ${item.name}`}
              onClick={() => setArchiving(item)}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
        {active.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No {noun}s yet.</li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button className="h-11" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add {noun}
        </Button>
        {archived.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived ({archived.length})
          </label>
        )}
      </div>

      {showArchived && archived.length > 0 && (
        <ul className="mt-3 divide-y rounded-md border text-muted-foreground">
          {archived.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              {leading?.(item)}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-xs">Archived</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Unarchive ${item.name}`}
                onClick={() => onArchive(item, false).catch(toastError)}
              >
                <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> Unarchive
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditSheet
          // A new key resets the form for each item.
          key={editing.item?.id ?? "new"}
          noun={noun}
          item={editing.item}
          initialExtra={initialExtra}
          extraFields={extraFields}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{archiving?.name}”?</DialogTitle>
            <DialogDescription>
              It will no longer be offered when you add a transaction. Past transactions keep it,
              and you can unarchive it any time. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setArchiving(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const item = archiving;
                setArchiving(null);
                if (item) void onArchive(item, true).catch(toastError);
              }}
            >
              Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditSheet<I extends ListItem, E>({
  noun,
  item,
  initialExtra,
  extraFields,
  onSave,
  onClose,
}: {
  noun: string;
  item?: I;
  initialExtra: (item?: I) => E;
  extraFields?: (value: E, set: (value: E) => void) => ReactNode;
  onSave: Props<I, E>["onSave"];
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [extra, setExtra] = useState(() => initialExtra(item));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name");
      return;
    }
    setSaving(true);
    try {
      await onSave({ item, name: trimmed, extra });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.response.status === 409) {
        setError(`You already have a ${noun} called ${trimmed}`);
      } else {
        toastError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item ? `Edit ${noun}` : `Add ${noun}`}</SheetTitle>
          <SheetDescription className="sr-only">{sentence(noun)} details</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="ref-name">Name</Label>
            <Input
              id="ref-name"
              value={name}
              maxLength={100}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "ref-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="ref-name-error" role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          {extraFields?.(extra, setExtra)}
          <Button type="submit" className="h-11 w-full" disabled={saving}>
            Save
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
