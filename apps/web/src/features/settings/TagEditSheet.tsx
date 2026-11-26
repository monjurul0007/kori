import { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { normalizeTagName } from "@/lib/tags";
import { toastError } from "@/lib/toast";

import { ConfirmFooter } from "./ConfirmFooter";
import type { Tag } from "./hooks";

const FORM_ID = "tag-form";
const UNPROCESSABLE = 422;
export const TAG_NAME_MAX = 30;

export const transactionCount = (n: number) => `${n} transaction${n === 1 ? "" : "s"}`;

interface Props {
  tag: Tag;
  /** Every other tag, to spot a rename that merges into one. */
  others: Tag[];
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onClose: () => void;
}

export function TagEditSheet({ tag, others, onRename, onDelete, onClose }: Props) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const normalized = normalizeTagName(name);
  const mergeTarget =
    normalized === tag.name ? undefined : others.find((t) => t.name === normalized);

  async function run(action: () => Promise<unknown>, onFailure: (err: unknown) => void) {
    setIsPending(true);
    try {
      await action();
      onClose();
    } catch (err) {
      onFailure(err);
    } finally {
      setIsPending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return setError("Enter a name");
    if (normalized.length > TAG_NAME_MAX) {
      return setError(`Tag names can be at most ${TAG_NAME_MAX} characters`);
    }
    if (normalized === tag.name) return onClose();
    void run(
      () => onRename(normalized),
      (err) => {
        if (err instanceof ApiError && err.response.status === UNPROCESSABLE) {
          setError(err.problem.detail);
        } else {
          toastError(err);
        }
      },
    );
  }

  function remove() {
    void run(onDelete, (err) => {
      setIsConfirmingDelete(false);
      toastError(err);
    });
  }

  return (
    <FormSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit tag"
      description={`Rename, merge or delete #${tag.name}`}
      dirty={name !== tag.name}
      onEscapeKeyDown={(event) => {
        if (!isConfirmingDelete) return;
        event.preventDefault();
        setIsConfirmingDelete(false);
      }}
      footer={
        isConfirmingDelete ? (
          <ConfirmFooter
            confirmLabel="Delete"
            isPending={isPending}
            onCancel={() => setIsConfirmingDelete(false)}
            onConfirm={remove}
          />
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete tag
            </Button>
            <Button type="submit" form={FORM_ID} className="h-12 flex-1" disabled={isPending}>
              {mergeTarget ? "Merge" : "Save"}
            </Button>
          </>
        )
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-4">
        <Field
          label="Name"
          hint="Tags are saved in lowercase; spaces become hyphens."
          error={error ?? undefined}
        >
          {(control) => (
            <Input
              {...control}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        {normalized && <p className="text-sm">Saved as #{normalized}</p>}
        {mergeTarget && (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            #{mergeTarget.name} already exists. Merge #{tag.name} into #{mergeTarget.name}?{" "}
            {transactionCount(tag.usage_count)} will use #{mergeTarget.name}.
          </p>
        )}
      </form>
      {isConfirmingDelete ? (
        <div role="group" aria-label="Confirm delete" className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Delete #{tag.name}?</p>
          <p className="text-muted-foreground">
            It will be removed from {transactionCount(tag.usage_count)}. The transactions themselves
            stay.
          </p>
        </div>
      ) : (
        <Link
          to={`/transactions?tag=${encodeURIComponent(tag.name)}`}
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View transactions tagged #{tag.name}
        </Link>
      )}
    </FormSheet>
  );
}
