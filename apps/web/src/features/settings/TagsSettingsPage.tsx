import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTags } from "@/features/transactions/hooks";
import { normalizeTagName } from "@/lib/tags";
import { toastSuccess } from "@/lib/toast";

import { useDeleteTag, useRenameTag, type Tag } from "./hooks";
import { SETTINGS_PARENT } from "./parent";
import { TagEditSheet, transactionCount } from "./TagEditSheet";

export function TagsSettingsPage() {
  const tags = useTags();
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [query, setQuery] = useState("");

  const sorted = [...(tags.data ?? [])].sort(
    (a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name),
  );
  const needle = normalizeTagName(query);
  const shown = sorted.filter((tag) => tag.name.includes(needle));

  return (
    <>
      <PageHeader title="Tags" backTo={SETTINGS_PARENT} />
      {tags.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : tags.isError ? (
        <p role="alert">Couldn’t load tags.</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tags you add to transactions appear here.</p>
      ) : (
        <>
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Find a tag"
              placeholder="Find a tag"
              className="h-11 pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags match “{query}”.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {shown.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    aria-label={`Edit #${tag.name}`}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
                    onClick={() => setEditing(tag)}
                  >
                    <span className="min-w-0 flex-1 break-words">#{tag.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {transactionCount(tag.usage_count)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Tags are saved in lowercase; spaces become hyphens.
          </p>
        </>
      )}

      {editing && (
        <TagEditSheet
          key={editing.id}
          tag={editing}
          others={sorted.filter((t) => t.id !== editing.id)}
          onRename={(name) => rename.mutateAsync({ id: editing.id, name })}
          onDelete={() =>
            remove.mutateAsync(editing.id).then(() => toastSuccess(`Deleted #${editing.name}`))
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
