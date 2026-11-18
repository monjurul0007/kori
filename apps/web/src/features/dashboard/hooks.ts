import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";

/** Every report query key starts with "reports", so one invalidation refreshes the dashboard. */
export const REPORTS_KEY = ["reports"] as const;

export const TREND_MONTHS = 6;

export function useSpending(month: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, "spending", month],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/reports/spending", { params: { query: { month } } })),
  });
}

export function useBudgetStatus(month: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, "budget-status", month],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/reports/budget-status", { params: { query: { month } } })),
  });
}

export function useTrend(month: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, "trend", month],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/reports/trend", {
          params: { query: { end: month, months: TREND_MONTHS } },
        }),
      ),
  });
}
