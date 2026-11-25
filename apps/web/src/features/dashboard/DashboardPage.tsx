import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { MonthPicker } from "@/components/ui/month-picker";
import { InstallCard } from "@/pwa/InstallCard";
import { monthOf, todayInDhaka } from "@/lib/dates";

import { CategoryBreakdown } from "./CategoryBreakdown";
import { HeroCard } from "./HeroCard";
import { NeedsAttention } from "./NeedsAttention";
import { RecentTransactions } from "./RecentTransactions";
import { TotalsCard } from "./TotalsCard";
import { TrendChart } from "./TrendChart";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("month");
  const month = requested && MONTH.test(requested) ? requested : monthOf(todayInDhaka());

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<MonthPicker month={month} onChange={(m) => setParams({ month: m })} />}
      />
      <div className="space-y-3">
        <InstallCard />
        <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
          <HeroCard month={month} />
          <TotalsCard month={month} />
          <NeedsAttention month={month} className="md:order-last" />
          <CategoryBreakdown month={month} />
          <TrendChart month={month} />
          <RecentTransactions month={month} />
        </div>
      </div>
    </>
  );
}
