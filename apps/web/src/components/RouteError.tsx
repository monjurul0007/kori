import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

import { Button, buttonVariants } from "@/components/ui/button";

/** Route-level error UI. React Router renders it when a route throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 p-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p role="alert" className="text-sm text-muted-foreground">
        {message}
      </p>
      <p className="text-sm text-muted-foreground">Reload the page, or go back to the dashboard.</p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
