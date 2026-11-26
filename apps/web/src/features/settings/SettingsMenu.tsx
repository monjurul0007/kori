import { ChevronRight, Download, UserRound, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { useSession } from "@/features/auth/session";
import { useCategories, usePaymentMethods, useTags } from "@/features/transactions/hooks";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";

import { currencyLabel } from "./currency";
import { LogoutButton } from "./LogoutButton";
import { SETTINGS_SECTIONS } from "./sections";
import { ThemeSwitch } from "./ThemeSwitch";

const ROW_CLASS = "flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-muted";

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/** Item counts by section path; a count is undefined until its list has loaded. */
function useSectionCounts(): Record<string, number | undefined> {
  const categories = useCategories();
  const paymentMethods = usePaymentMethods();
  const tags = useTags();
  return {
    "/settings/categories": categories.data?.length,
    "/settings/payment-methods": paymentMethods.data?.length,
    "/settings/tags": tags.data?.length,
  };
}

/** The phone Settings page: a profile row, the theme switch and a grouped list of sections. */
export function SettingsMenu() {
  const { user } = useSession();
  const install = useInstallPrompt();
  const counts = useSectionCounts();

  return (
    <>
      <PageHeader title="Settings" />
      <section
        aria-label="Profile"
        className="mb-3 flex items-center gap-3 rounded-2xl border bg-card p-4"
      >
        <RowIcon icon={UserRound} />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{user?.email}</p>
          <p className="text-muted-foreground">
            {user?.timezone}, {user ? currencyLabel(user.currency) : null}
          </p>
        </div>
      </section>
      <section aria-label="Appearance" className="mb-3 rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Theme</h2>
        <ThemeSwitch />
      </section>
      <ul className="mb-3 divide-y overflow-hidden rounded-2xl border bg-card">
        {SETTINGS_SECTIONS.filter((section) => section.to !== "/settings").map((section) => (
          <li key={section.to}>
            <Link to={section.to} className={ROW_CLASS}>
              <RowIcon icon={section.icon} />
              <span className="flex-1 text-sm">{section.label}</span>
              {counts[section.to] !== undefined && (
                <span className="text-xs text-muted-foreground">{counts[section.to]}</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {install.canPrompt && (
          <li>
            <button type="button" className={ROW_CLASS} onClick={() => void install.prompt()}>
              <RowIcon icon={Download} />
              <span className="flex-1 text-sm">Install Kori</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
      <LogoutButton />
    </>
  );
}
