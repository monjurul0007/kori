import { useState } from "react";
import { Outlet } from "react-router-dom";

import { AddTransactionSheet } from "./AddTransactionSheet";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export interface ShellContext {
  openAdd: () => void;
}

export function AppShell() {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex min-h-dvh">
      <SideNav onAdd={() => setAdding(true)} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4">
        <Outlet context={{ openAdd: () => setAdding(true) } satisfies ShellContext} />
      </main>
      <BottomNav onAdd={() => setAdding(true)} />
      <AddTransactionSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
