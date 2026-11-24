import { Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDisplayDate } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { toastError } from "@/lib/toast";

import { useDeleteRule, usePauseRule, useRules, type Rule } from "./hooks";
import { RecurringRuleSheet } from "./RecurringRuleSheet";
import { formatSchedule } from "./schedule";

const GROUPS = [
  { status: "active", title: "Active" },
  { status: "paused", title: "Paused" },
  { status: "ended", title: "Ended" },
] as const;

function RuleRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: Rule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pause = usePauseRule();
  const paused = rule.status === "paused";
  return (
    <li className="space-y-1 px-3 py-2.5">
      <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{rule.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{rule.category.name}</span>
            <span>{formatSchedule(rule)}</span>
            {rule.next_due_on && rule.status === "active" && (
              <span>Next: {formatDisplayDate(rule.next_due_on)}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {formatTaka(rule.amount)}
        </span>
      </button>
      {rule.last_error && <p className="text-xs text-over">Paused: {rule.last_error}</p>}
      {rule.status !== "ended" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pause.isPending}
            aria-label={`${paused ? "Resume" : "Pause"} ${rule.name}`}
            onClick={() => pause.mutate({ id: rule.id, paused }, { onError: toastError })}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="outline" aria-label={`Delete ${rule.name}`} onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

export function RecurringRulesPage() {
  const rules = useRules();
  const remove = useDeleteRule();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Rule>();
  // `?rule=<id>` opens that rule's editor (the "Edit rule" link on a recurring transaction).
  const editing = rules.data?.find((r) => r.id === params.get("rule"));
  const closeEditor = () => setParams({}, { replace: true });

  return (
    <>
      <PageHeader
        title="Recurring"
        actions={
          <Button className="h-11" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add rule
          </Button>
        }
      />
      {rules.isPending && <Skeleton className="h-24 w-full" />}
      {rules.isError && (
        <p role="alert" className="text-sm text-over">
          Couldn't load your recurring rules.
        </p>
      )}
      {rules.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recurring rules yet. Add rent or a bill once and Kori logs it for you.
        </p>
      )}
      {rules.data &&
        GROUPS.map(({ status, title }) => {
          const group = rules.data.filter((r) => r.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status} aria-labelledby={`group-${status}`} className="mb-6">
              <h2 id={`group-${status}`} className="mb-2 font-medium">
                {title}
              </h2>
              <ul className="divide-y rounded-md border">
                {group.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onEdit={() => setParams({ rule: r.id }, { replace: true })}
                    onDelete={() => setDeleting(r)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      {creating && <RecurringRuleSheet onClose={() => setCreating(false)} />}
      {editing && <RecurringRuleSheet key={editing.id} rule={editing} onClose={closeEditor} />}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>Past transactions are kept.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(undefined)}>
              Cancel
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(undefined),
                  onError: toastError,
                })
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
