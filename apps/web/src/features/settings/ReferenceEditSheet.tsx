import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/api/client";
import { problemFieldErrors } from "@/lib/problem";
import { toastError } from "@/lib/toast";

import { ConfirmFooter } from "./ConfirmFooter";
import { COUNTER_WITHIN, tooLong } from "./nameLimits";
import type { ListItem } from "./ReferenceListEditor";

const FORM_ID = "reference-form";
const CONFLICT = 409;

const isNameLocation = (loc: unknown[]) => (loc[loc.length - 1] === "name" ? "name" : undefined);

interface Props<I extends ListItem, E> {
  noun: string;
  maxNameLength: number;
  /** Absent when adding. */
  item?: I;
  initialExtra: (item?: I) => E;
  extraFields?: (value: E, set: (value: E) => void) => ReactNode;
  onSave: (input: { item?: I; name: string; extra: E }) => Promise<unknown>;
  /** Present when the item can be archived from here. */
  onArchive?: (item: I) => Promise<unknown>;
  onClose: () => void;
}

export function ReferenceEditSheet<I extends ListItem, E>({
  noun,
  maxNameLength,
  item,
  initialExtra,
  extraFields,
  onSave,
  onArchive,
  onClose,
}: Props<I, E>) {
  const [name, setName] = useState(item?.name ?? "");
  const [extra, setExtra] = useState(() => initialExtra(item));
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);

  const nameLength = [...name].length;
  const isDirty =
    name !== (item?.name ?? "") || JSON.stringify(extra) !== JSON.stringify(initialExtra(item));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a name");
    if ([...trimmed].length > maxNameLength) return setError(tooLong(maxNameLength));
    setIsPending(true);
    try {
      await onSave({ item, name: trimmed, extra });
      onClose();
    } catch (err) {
      showSaveError(err, trimmed);
    } finally {
      setIsPending(false);
    }
  }

  function showSaveError(err: unknown, trimmed: string) {
    if (err instanceof ApiError && err.response.status === CONFLICT) {
      return setError(`You already have a ${noun} called ${trimmed}`);
    }
    const [onName] = problemFieldErrors(err, isNameLocation);
    if (onName) return setError(onName.message);
    toastError(err);
  }

  async function archive() {
    if (!item || !onArchive) return;
    setIsPending(true);
    try {
      await onArchive(item);
      onClose();
    } catch (err) {
      setIsConfirmingArchive(false);
      toastError(err);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <FormSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={item ? `Edit ${noun}` : `Add ${noun}`}
      description={`Name and details of the ${noun}.`}
      dirty={isDirty}
      onEscapeKeyDown={(event) => {
        if (!isConfirmingArchive) return;
        event.preventDefault();
        setIsConfirmingArchive(false);
      }}
      footer={
        isConfirmingArchive ? (
          <ConfirmFooter
            confirmLabel="Archive"
            isPending={isPending}
            onCancel={() => setIsConfirmingArchive(false)}
            onConfirm={() => void archive()}
          />
        ) : (
          <>
            {item && onArchive && (
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => setIsConfirmingArchive(true)}
              >
                Archive
              </Button>
            )}
            <Button type="submit" form={FORM_ID} className="h-12 flex-1" disabled={isPending}>
              Save
            </Button>
          </>
        )
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-4">
        <Field
          label="Name"
          hint={
            nameLength >= maxNameLength - COUNTER_WITHIN
              ? `${nameLength}/${maxNameLength}`
              : undefined
          }
          error={error ?? undefined}
        >
          {(control) => (
            <Input
              {...control}
              value={name}
              maxLength={maxNameLength}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        {extraFields?.(extra, setExtra)}
      </form>
      {isConfirmingArchive && item && (
        <div role="group" aria-label="Confirm archive" className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Archive “{item.name}”?</p>
          <p className="text-muted-foreground">
            It will no longer be offered when you add a transaction. Past transactions keep it, and
            you can unarchive it any time. Nothing is deleted.
          </p>
        </div>
      )}
    </FormSheet>
  );
}
