import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";

import { currencyLabel } from "./currency";
import { LogoutButton } from "./LogoutButton";
import { ThemeSwitch } from "./ThemeSwitch";

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="mb-4 rounded-2xl border bg-card p-[18px] text-card-foreground"
    >
      <h2 className="mb-3 font-display text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The desktop General page: profile, appearance, install and log out as cards. */
export function GeneralSettings() {
  const { user } = useSession();
  const install = useInstallPrompt();

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsCard title="Profile">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2.5 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{user?.timezone}</dd>
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{user ? currencyLabel(user.currency) : null}</dd>
        </dl>
      </SettingsCard>
      <SettingsCard title="Appearance">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">System follows your device setting.</p>
          </div>
          <div className="w-72">
            <ThemeSwitch />
          </div>
        </div>
      </SettingsCard>
      {install.canPrompt && (
        <SettingsCard title="Install Kori">
          <div className="flex items-center justify-between gap-6">
            <p className="text-sm text-muted-foreground">
              Opens like an app and loads without a connection.
            </p>
            <Button
              variant="outline"
              className="h-11"
              aria-label="Install Kori"
              onClick={() => void install.prompt()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Install
            </Button>
          </div>
        </SettingsCard>
      )}
      <LogoutButton />
    </>
  );
}
