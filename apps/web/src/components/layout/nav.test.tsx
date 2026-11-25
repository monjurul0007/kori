import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

import { navItems } from "./nav";

describe("navItems", () => {
  it("lists Dashboard, Transactions, Budgets and Settings in order", () => {
    expect(navItems.map((i) => [i.label, i.to])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Transactions", "/transactions"],
      ["Budgets", "/budgets"],
      ["Settings", "/settings"],
    ]);
  });

  it("shows the Budgets link in both navs and marks it current on /budgets", async () => {
    server.use(
      http.get("*/api/v1/auth/me", () =>
        HttpResponse.json({ id: "u1", display_name: "Demo", currency: "BDT" }),
      ),
      http.get("*/api/v1/*", () => HttpResponse.json({}, { status: 500 })),
    );
    renderApp("/budgets");
    const links = await screen.findAllByRole("link", { name: "Budgets" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(2);
  });

  it("labels the desktop primary action Add expense and keeps the tab bar button at least 44px", async () => {
    server.use(
      http.get("*/api/v1/auth/me", () =>
        HttpResponse.json({ id: "u1", display_name: "Demo", currency: "BDT" }),
      ),
      http.get("*/api/v1/*", () => HttpResponse.json({}, { status: 500 })),
    );
    renderApp("/dashboard");
    expect(await screen.findByRole("button", { name: "Add expense" })).toBeInTheDocument();
    const tabBarAdd = screen.getByRole("button", { name: "Add transaction" });
    expect(tabBarAdd).toHaveClass("h-14", "w-14");
  });

  it("shows the offline footer in the side nav", async () => {
    server.use(
      http.get("*/api/v1/auth/me", () =>
        HttpResponse.json({ id: "u1", display_name: "Demo", currency: "BDT" }),
      ),
      http.get("*/api/v1/*", () => HttpResponse.json({}, { status: 500 })),
    );
    renderApp("/dashboard");
    expect(await screen.findByText("Works offline")).toBeInTheDocument();
  });
});
