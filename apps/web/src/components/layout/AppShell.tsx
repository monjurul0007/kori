import { useEffect, useRef, useState } from "react";
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

function focusMain(event: React.MouseEvent<HTMLAnchorElement>) {
  // A hash link alone would change the URL and leave React Router's location out of step.
  event.preventDefault();
  document.getElementById("main")?.focus();
}

/** After a client-side navigation, announces the new page by focusing its H1 (not on first load). */
function useFocusHeadingOnNavigation(pathname: string) {
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [pathname]);
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
  useFocusHeadingOnNavigation(pathname);
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        onClick={focusMain}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:shadow focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <SideNav onAdd={() => setAdding(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="flex items-center px-4 pt-3 md:hidden">
          <Wordmark markSize={26} showBangla={false} className="text-[17px]" />
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto focus:outline-none w-full max-w-3xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4"
        >
          <Outlet context={{ openAdd: () => setAdding(true) } satisfies ShellContext} />
        </main>
      </div>
      <IosInstallSheet />
      <BottomNav onAdd={() => setAdding(true)} />
      <TransactionSheet open={adding} onOpenChange={setAdding} defaultDate={defaultDate} />
    </div>
  );
}
