import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

import { makeTx } from "../transactions/fixtures";

const user = {
  id: "u1",
  email: "m@e.c",
  display_name: "D",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

function mockAll() {
  const months: string[] = [];
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () => HttpResponse.json([])),
    http.get("*/api/v1/reports/*", ({ request }) => {
      months.push(new URL(request.url).searchParams.get("month") ?? "");
      return HttpResponse.json({}, { status: 500 });
    }),
    http.get("*/api/v1/transactions", () =>
      HttpResponse.json({ items: [makeTx("t1")], next_cursor: null, totals: {} }),
    ),
  );
  return months;
}

describe("DashboardPage", () => {
  it("uses the month in the URL", async () => {
    const months = mockAll();
    renderApp("/dashboard?month=2026-03");
    expect(await screen.findByText("March 2026")).toBeInTheDocument();
    await waitFor(() => expect(months).toContain("2026-03"));
  });

  it("falls back to the current month for a bad ?month=", async () => {
    mockAll();
    renderApp("/dashboard?month=nonsense");
    expect(await screen.findByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.queryByText(/nonsense/)).not.toBeInTheDocument();
  });

  it("keeps rendering every card when reports fail", async () => {
    mockAll();
    renderApp("/dashboard?month=2026-03");
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where it went" })).toBeInTheDocument();
  });

  it("goes from the page h1 to h2 card titles without skipping a level", async () => {
    mockAll();
    renderApp("/dashboard?month=2026-03");
    await screen.findByRole("heading", { name: "Recent" });
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 2, name: "Recent" })).toBeVisible();
  });
});
