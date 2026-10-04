import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrapEmpty } from "@/api/client";

import { sessionKey } from "./session";

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      unwrapEmpty(await api.POST("/api/v1/auth/login", { body }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: sessionKey }),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrapEmpty(await api.POST("/api/v1/auth/logout"));
    },
    onSettled: () => client.clear(),
  });
}
