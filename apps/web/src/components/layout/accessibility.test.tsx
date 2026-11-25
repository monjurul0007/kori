import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { formatMonth, monthOf, todayInDhaka } from "@/lib/dates";
import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const user = {
  id: "7d9f6b1e-2d1c-4c57-9b0a-1d6a2e0f4a11",
  email: "me@example.com",
  display_name: "Demo User",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

function signedIn() {
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/*", () => HttpResponse.json({}, { status: 500 })),
  );
}

const THIS_MONTH = formatMonth(monthOf(todayInDhaka()));

const TITLES: [string, string][] = [
  ["/dashboard", "Dashboard · Kori"],
  ["/transactions", `Transactions · ${THIS_MONTH} · Kori`],
  ["/budgets", `Budgets · ${THIS_MONTH} · Kori`],
  ["/settings", "Settings · Kori"],
  ["/settings/categories", "Categories · Settings · Kori"],
  ["/settings/payment-methods", "Payment methods · Settings · Kori"],
  ["/settings/tags", "Tags · Settings · Kori"],
  ["/nowhere", "Page not found · Kori"],
];

describe("page titles", () => {
  it.each(TITLES)("%s is titled %s", async (path, title) => {
    signedIn();
    renderApp(path);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(document.title).toBe(title));
  });

  it("titles the login page", async () => {
    server.use(
      http.get("*/api/v1/auth/me", () =>
        HttpResponse.json(
          { type: "about:blank", title: "Unauthorized", status: 401, request_id: "r1" },
          { status: 401, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp("/login");
    await screen.findByLabelText("Email");
    expect(document.title).toBe("Log in · Kori");
  });
});

describe("skip link", () => {
  it("is the first focusable element and moves focus to the main region", async () => {
    signedIn();
    const actor = userEvent.setup();
    renderApp("/dashboard");
    await screen.findByRole("heading", { level: 1 });
    await actor.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    await actor.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("focus on navigation", () => {
  it("does not steal focus on the first load", async () => {
    signedIn();
    renderApp("/dashboard");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).not.toHaveFocus();
  });

  it("moves focus to the new page heading after a client-side navigation", async () => {
    signedIn();
    const actor = userEvent.setup();
    renderApp("/dashboard");
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    const [budgetsLink] = screen.getAllByRole("link", { name: "Budgets" });
    if (!budgetsLink) throw new Error("Budgets link missing");
    await actor.click(budgetsLink);
    const heading = await screen.findByRole("heading", { level: 1, name: "Budgets" });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("settings back link", () => {
  it.each(["/settings/categories", "/settings/payment-methods", "/settings/tags"])(
    "%s links back to Settings",
    async (path) => {
      signedIn();
      renderApp(path);
      await screen.findByRole("heading", { level: 1 });
      const back = within(screen.getByRole("main")).getByRole("link", { name: "Back to Settings" });
      expect(back).toHaveAttribute("href", "/settings");
    },
  );
});
