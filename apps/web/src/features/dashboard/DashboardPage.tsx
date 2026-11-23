import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { InstallCard } from "@/pwa/InstallCard";
import { monthOf, todayInDhaka } from "@/lib/dates";

import { MonthSwitcher } from "../transactions/MonthSwitcher";
import { BudgetSummaryCard } from "./BudgetSummaryCard";
import { BudgetWarnings } from "./BudgetWarnings";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { RecentTransactions } from "./RecentTransactions";
import { TrendChart } from "./TrendChart";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("month");
  const month = requested && MONTH.test(requested) ? requested : monthOf(todayInDhaka());

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="space-y-3">
        <InstallCard />
        <MonthSwitcher month={month} onChange={(m) => setParams({ month: m })} />
        <div className="grid gap-3 md:grid-cols-2">
          <BudgetSummaryCard month={month} />
          <BudgetWarnings month={month} />
          <CategoryBreakdown month={month} />
          <TrendChart month={month} />
          <RecentTransactions month={month} />
        </div>
      </div>
    </>
  );
}
