import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { server } from "@/test/setup";

export function renderCard(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const mockGet = (path: string, body: unknown, status = 200) =>
  server.use(http.get(`*${path}`, () => HttpResponse.json(body as object, { status })));

export const cat = (id: string, name: string) => ({
  id,
  name,
  kind: "expense" as const,
  archived: false,
});
