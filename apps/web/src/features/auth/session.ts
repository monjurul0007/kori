import { useQuery } from "@tanstack/react-query";

import { ApiError, api, unwrap } from "@/api/client";

export const sessionKey = ["session"] as const;

export function useSession() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: async () => unwrap(await api.GET("/api/v1/auth/me")),
    retry: (count, error) => !(error instanceof ApiError) && count < 1,
    staleTime: 5 * 60 * 1000,
  });
  const loggedOut = query.error instanceof ApiError && query.error.response.status === 401;
  return { ...query, user: query.data, loggedOut };
}

/** A `next` target is only honoured when it is a same-origin path. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/transactions";
  }
  return next;
}
