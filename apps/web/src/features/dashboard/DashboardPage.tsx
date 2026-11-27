import { Target } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthPicker } from "@/components/ui/month-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallCard } from "@/pwa/InstallCard";
import { monthOf, todayInDhaka } from "@/lib/dates";

import { CategoryBreakdown } from "./CategoryBreakdown";
import { HeroCard } from "./HeroCard";
import { NeedsAttention } from "./NeedsAttention";
import { RecentTransactions } from "./RecentTransactions";
import { TotalsCard } from "./TotalsCard";
import { TrendChart } from "./TrendChart";
import { useOnboarding } from "./useOnboarding";
import { WelcomeCard } from "./WelcomeCard";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("month");
  const month = requested && MONTH.test(requested) ? requested : monthOf(todayInDhaka());
  const onboarding = useOnboarding();
  const isEmptyAccount = onboarding.hasTransactions === false;

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<MonthPicker month={month} onChange={(m) => setParams({ month: m })} />}
      />
      <div className="space-y-3">
        {onboarding.isCardVisible ? <WelcomeCard onboarding={onboarding} /> : <InstallCard />}
        {onboarding.isLoading && <Skeleton aria-label="Loading dashboard" className="h-40" />}
        {isEmptyAccount && (
          <EmptyState
            icon={Target}
            heading="Your spending will show here"
            message="Trends appear after your first month."
            className="rounded-2xl border-[1.5px] border-dashed py-8"
          />
        )}
        {!onboarding.isLoading && !isEmptyAccount && (
          <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
            <HeroCard month={month} />
            <TotalsCard month={month} />
            <NeedsAttention month={month} className="md:order-last" />
            <CategoryBreakdown month={month} />
            <TrendChart month={month} />
            <RecentTransactions month={month} />
          </div>
        )}
      </div>
    </>
  );
}
