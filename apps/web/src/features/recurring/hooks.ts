import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty } from "@/api/client";
import type { components } from "@/api/schema";

export type Rule = components["schemas"]["RuleOut"];
export type RuleIn = components["schemas"]["RuleIn"];
export type RuleUpdate = components["schemas"]["RuleUpdate"];

export function useRules() {
  return useQuery({
    queryKey: ["recurring-rules"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/recurring-rules", { params: { query: { include_ended: true } } }),
      ),
  });
}

function useRefreshRules() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["recurring-rules"] });
}

export function useCreateRule() {
  const refresh = useRefreshRules();
  return useMutation({
    mutationFn: async (body: RuleIn) => unwrap(await api.POST("/api/v1/recurring-rules", { body })),
    onSuccess: refresh,
  });
}

export function useUpdateRule(id: string) {
  const refresh = useRefreshRules();
  return useMutation({
    mutationFn: async (body: RuleUpdate) =>
      unwrap(
        await api.PATCH("/api/v1/recurring-rules/{rule_id}", {
          params: { path: { rule_id: id } },
          body,
        }),
      ),
    onSuccess: refresh,
  });
}

export function usePauseRule() {
  const refresh = useRefreshRules();
  return useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) =>
      unwrap(
        await api.POST(
          paused
            ? "/api/v1/recurring-rules/{rule_id}/resume"
            : "/api/v1/recurring-rules/{rule_id}/pause",
          { params: { path: { rule_id: id } } },
        ),
      ),
    onSuccess: refresh,
  });
}

/** Past transactions are kept but lose their link, so the transactions list refreshes too. */
export function useDeleteRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapEmpty(
        await api.DELETE("/api/v1/recurring-rules/{rule_id}", {
          params: { path: { rule_id: id } },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["recurring-rules"] }),
        client.invalidateQueries({ queryKey: ["transactions"] }),
      ]),
  });
}
