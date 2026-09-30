import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function HealthStatus() {
  const { data, error, isPending } = useQuery({
    queryKey: ["healthz"],
    queryFn: async () => unwrap(await api.GET("/api/v1/healthz")),
  });

  if (isPending) return <Skeleton className="h-5 w-32" aria-label="Checking API" />;
  if (error) return <p role="alert">API unreachable: {error.message}</p>;
  return <p>API status: {data.status}</p>;
}
