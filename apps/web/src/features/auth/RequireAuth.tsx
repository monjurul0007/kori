import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { useSession } from "./session";

export function RequireAuth() {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) {
    return <Skeleton className="m-4 h-8 w-40" aria-label="Loading session" />;
  }
  if (!session.user) {
    if (session.loggedOut) {
      const next = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?next=${next}`} replace />;
    }
    return (
      <p role="alert" className="p-4">
        Could not reach Kori: {session.error?.message}
      </p>
    );
  }
  return <Outlet />;
}
