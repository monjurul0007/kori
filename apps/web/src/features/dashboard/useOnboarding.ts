import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api, unwrap } from "@/api/client";
import { monthOf, todayInDhaka } from "@/lib/dates";
import { useLocalFlag } from "@/lib/localFlag";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";

import { REPORTS_KEY, useBudgetStatus } from "./hooks";
import { CATEGORIES_REVIEWED_KEY, ONBOARDING_HIDDEN_KEY } from "./onboardingKeys";

export type OnboardingStepId = "login" | "expense" | "budget" | "categories" | "install";

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

/** Whether the account has any transaction at all, in any month. */
export function useHasTransactions() {
  return useQuery({
    // Under REPORTS_KEY so saving or deleting a transaction refreshes it. It must not sit under
    // "transactions": that cache holds infinite-query pages, and a boolean there breaks readers.
    queryKey: [...REPORTS_KEY, "has-transactions"],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/transactions", { params: { query: { limit: 1 } } })).items
        .length > 0,
  });
}

/**
 * The first-run checklist, derived from queries the app already makes plus two local flags.
 * The install step is left out where installing isn't possible (for example desktop Firefox), so
 * it can't keep the card open forever.
 */
export function useOnboarding() {
  const hasTransactions = useHasTransactions();
  const budgetStatus = useBudgetStatus(monthOf(todayInDhaka()));
  const [categoriesReviewed] = useLocalFlag(CATEGORIES_REVIEWED_KEY);
  const [isHiddenForGood, rememberHidden] = useLocalFlag(ONBOARDING_HIDDEN_KEY);
  // Also kept in state so Hide works for this visit when storage is blocked.
  const [isHiddenNow, setIsHiddenNow] = useState(false);
  const isHidden = isHiddenForGood || isHiddenNow;
  const hide = () => {
    rememberHidden();
    setIsHiddenNow(true);
  };
  const install = useInstallPrompt();

  const steps: OnboardingStep[] = [
    { id: "login", done: true },
    { id: "expense", done: hasTransactions.data === true },
    { id: "budget", done: Boolean(budgetStatus.data?.overall) },
    { id: "categories", done: categoriesReviewed },
  ];
  if (install.installed || install.canPrompt) {
    steps.push({ id: "install", done: install.installed });
  }

  // The page only waits for the transaction lookup. A slow or failing budget report must not hold
  // the whole dashboard back, so only the card waits for it, to avoid ticking a step late.
  const isLoading = hasTransactions.isPending;
  const isChecklistReady = !hasTransactions.isPending && !budgetStatus.isPending;
  const hasOpenStep = steps.some((step) => !step.done);
  return {
    steps,
    isLoading,
    /** Undefined while loading or when the lookup failed, so callers can keep the normal page. */
    hasTransactions: hasTransactions.data,
    isCardVisible: isChecklistReady && !isHidden && hasOpenStep,
    hide,
    promptInstall: install.prompt,
  };
}

export type Onboarding = ReturnType<typeof useOnboarding>;
