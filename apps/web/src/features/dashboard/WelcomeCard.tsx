import { Check, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { TransactionSheet } from "../transactions/form/TransactionSheet";
import type { Onboarding, OnboardingStepId } from "./useOnboarding";

const STEP_LABELS: Record<OnboardingStepId, string> = {
  login: "Log in",
  expense: "Add your first expense",
  budget: "Set a monthly budget",
  categories: "Check your categories",
  install: "Install Kori on this phone",
};

const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five"];

const ROW =
  "grid min-h-11 grid-cols-[22px_1fr_auto] items-center gap-x-3 border-t py-2 first:border-t-0";

function Checkbox({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-5 w-5 place-items-center rounded-full border-[1.5px]",
        done && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {done && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function StepRow({
  done,
  label,
  children,
}: {
  done: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <li className={ROW}>
      <Checkbox done={done} />
      <span className={cn("text-sm", done && "text-muted-foreground line-through")}>
        {label}
        {done && <span className="sr-only"> (done)</span>}
      </span>
      {children}
    </li>
  );
}

const CHEVRON = <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;

/** The "Welcome to Kori" checklist: each step ticks itself once the thing it asks for exists. */
export function WelcomeCard({ onboarding }: { onboarding: Onboarding }) {
  const [isAdding, setIsAdding] = useState(false);
  const openCount = onboarding.steps.filter((step) => !step.done).length;

  return (
    <Card className="p-5 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Welcome to Kori</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {COUNT_WORDS[openCount]} {openCount === 1 ? "step" : "steps"} and your month is set up.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onboarding.hide}>
          Hide
        </Button>
      </div>
      <ul className="mt-3">
        {onboarding.steps.map(({ id, done }) => (
          <StepRow key={id} done={done} label={STEP_LABELS[id]}>
            {id === "expense" && !done && (
              <Button
                size="sm"
                aria-label="Add your first expense"
                onClick={() => setIsAdding(true)}
              >
                Add
              </Button>
            )}
            {id === "budget" && !done && (
              <Link to="/budgets" aria-label="Set a monthly budget" className="-mr-2 p-2">
                {CHEVRON}
              </Link>
            )}
            {id === "categories" && !done && (
              <Link
                to="/settings/categories"
                aria-label="Check your categories"
                className="-mr-2 p-2"
              >
                {CHEVRON}
              </Link>
            )}
            {id === "install" && !done && (
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2"
                aria-label="Install Kori on this phone"
                onClick={() => void onboarding.promptInstall()}
              >
                {CHEVRON}
              </Button>
            )}
          </StepRow>
        ))}
      </ul>
      <TransactionSheet open={isAdding} onOpenChange={setIsAdding} />
    </Card>
  );
}
