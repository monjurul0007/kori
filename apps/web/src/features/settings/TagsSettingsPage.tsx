import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizeTagName } from "@/lib/tags";
import { toastError } from "@/lib/toast";

import { useDeleteTag, useRenameTag, type Tag } from "./hooks";
import { SETTINGS_PARENT } from "./parent";
import { useTags } from "@/features/transactions/hooks";

const count = (n: number) => `${n} transaction${n === 1 ? "" : "s"}`;

export function TagsSettingsPage() {
  const tags = useTags();
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [renaming, setRenaming] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const sorted = [...(tags.data ?? [])].sort(
    (a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name),
  );

  return (
    <>
      <PageHeader title="Tags" parent={SETTINGS_PARENT} />
      {tags.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : tags.isError ? (
        <p role="alert">Couldn’t load tags.</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tags you add to transactions appear here.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sorted.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2 px-3 py-1">
              <Link
                to={`/transactions?tag=${encodeURIComponent(tag.name)}`}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2"
              >
                <span className="truncate">#{tag.name}</span>
                <span className="text-xs text-muted-foreground">{count(tag.usage_count)}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Rename #${tag.name}`}
                onClick={() => setRenaming(tag)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete #${tag.name}`}
                onClick={() => setDeleting(tag)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {renaming && (
        <RenameSheet
          key={renaming.id}
          tag={renaming}
          others={sorted.filter((t) => t.id !== renaming.id)}
          onSave={(name) => rename.mutateAsync({ id: renaming.id, name })}
          onClose={() => setRenaming(null)}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete #{deleting?.name}?</DialogTitle>
            <DialogDescription>
              It will be removed from {count(deleting?.usage_count ?? 0)}. The transactions
              themselves stay.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const tag = deleting;
                setDeleting(null);
                if (tag) void remove.mutateAsync(tag.id).catch(toastError);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RenameSheet({
  tag,
  others,
  onSave,
  onClose,
}: {
  tag: Tag;
  others: Tag[];
  onSave: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mergeInto, setMergeInto] = useState<Tag | null>(null);

  async function save(normalized: string) {
    setSaving(true);
    try {
      await onSave(normalized);
      onClose();
    } catch (err) {
      setMergeInto(null);
      if (err instanceof ApiError && err.response.status === 422) setError(err.problem.detail);
      else toastError(err);
    } finally {
      setSaving(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeTagName(name);
    if (!normalized) return setError("Enter a name");
    if (normalized.length > 30) return setError("Tag names can be at most 30 characters");
    if (normalized === tag.name) return onClose();
    const target = others.find((t) => t.name === normalized);
    if (target) setMergeInto(target);
    else void save(normalized);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Rename tag</SheetTitle>
          <SheetDescription className="sr-only">Rename or merge #{tag.name}</SheetDescription>
        </SheetHeader>
        {mergeInto ? (
          <div className="mt-4 space-y-4">
            <p>
              Merge #{tag.name} into #{mergeInto.name}? {count(tag.usage_count)} will use #
              {mergeInto.name}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="h-11" onClick={() => setMergeInto(null)}>
                Back
              </Button>
              <Button className="h-11" disabled={saving} onClick={() => void save(mergeInto.name)}>
                Merge
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={name}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "tag-name-error" : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              {error && (
                <p id="tag-name-error" role="alert" className="text-sm text-over">
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="h-11" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
