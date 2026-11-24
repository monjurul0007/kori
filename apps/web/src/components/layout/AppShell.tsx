import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { IosInstallSheet } from "@/pwa/IosInstallSheet";
import { defaultDateForMonth } from "@/lib/dates";
import { OfflineBanner } from "@/pwa/OfflineBanner";
import { TransactionSheet } from "@/features/transactions/form/TransactionSheet";

import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export interface ShellContext {
  openAdd: () => void;
}

export function AppShell() {
  const [adding, setAdding] = useState(false);
  // While a month of the transactions list is on screen, new entries start in that month.
  const { pathname, search } = useLocation();
  const viewedMonth =
    pathname === "/transactions" ? new URLSearchParams(search).get("month") : null;
  const defaultDate =
    viewedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(viewedMonth)
      ? defaultDateForMonth(viewedMonth)
      : undefined;
  return (
    <div className="flex min-h-dvh">
      <SideNav onAdd={() => setAdding(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="flex items-center px-4 pt-3 md:hidden">
          <Wordmark markSize={26} className="text-[17px]" />
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4">
          <Outlet context={{ openAdd: () => setAdding(true) } satisfies ShellContext} />
        </main>
      </div>
      <IosInstallSheet />
      <BottomNav onAdd={() => setAdding(true)} />
      <TransactionSheet open={adding} onOpenChange={setAdding} defaultDate={defaultDate} />
    </div>
  );
}
