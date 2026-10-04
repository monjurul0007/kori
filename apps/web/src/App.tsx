import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { setUnauthorizedHandler } from "@/api/client";
import { router } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// An expired session on any call: drop cached data and go to login, remembering where we were.
setUnauthorizedHandler(() => {
  queryClient.clear();
  const { pathname, search } = window.location;
  if (pathname !== "/login") {
    void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
