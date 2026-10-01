import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";

import { HealthStatus } from "./HealthStatus";

function renderHealth() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

describe("HealthStatus", () => {
  it("shows the API status", async () => {
    server.use(http.get("*/api/v1/healthz", () => HttpResponse.json({ status: "ok" })));
    renderHealth();
    expect(await screen.findByText("API status: ok")).toBeInTheDocument();
  });

  it("shows the problem+json detail when the API fails", async () => {
    server.use(
      http.get("*/api/v1/healthz", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Service Unavailable",
            status: 503,
            detail: "db down",
            request_id: "r1",
          },
          { status: 503, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderHealth();
    expect(await screen.findByRole("alert")).toHaveTextContent("API unreachable: db down");
  });
});
