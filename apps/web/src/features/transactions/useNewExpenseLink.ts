import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { NEW_EXPENSE_PARAM, NEW_EXPENSE_VALUE } from "@/pwa/manifest";

/**
 * Opens the Add sheet once when the page is reached through the installed app's "Add expense"
 * shortcut, then drops the parameter so a refresh or back doesn't reopen it.
 */
export function useNewExpenseLink(openAdd: () => void) {
  const [params, setParams] = useSearchParams();
  const isRequested = params.get(NEW_EXPENSE_PARAM) === NEW_EXPENSE_VALUE;

  useEffect(() => {
    if (!isRequested) return;
    openAdd();
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(NEW_EXPENSE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [isRequested, openAdd, setParams]);
}
