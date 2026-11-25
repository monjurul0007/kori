import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";
import { renderApp } from "@/test/renderApp";

const user = {
  id: "7d9f6b1e-2d1c-4c57-9b0a-1d6a2e0f4a11",
  email: "me@example.com",
  display_name: "Demo User",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

describe("unknown URLs", () => {
  it("shows Page not found inside the app shell, with a way back", async () => {
    server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json(user)));
    renderApp("/budget");
    expect(
      await screen.findByRole("heading", { level: 1, name: "This page doesn't exist" }),
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByText("The link may be old or mistyped. Your data is safe."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    // The shell navigation is still there.
    expect(screen.getAllByRole("link", { name: /transactions/i }).length).toBeGreaterThan(0);
  });

  it("goes to the dashboard from Go back when there is no history to return to", async () => {
    server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json(user)));
    const { router } = renderApp("/budget");
    await userEvent.click(await screen.findByRole("button", { name: "Go back" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("covers nested unknown paths too", async () => {
    server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json(user)));
    renderApp("/settings/foo");
    expect(
      await screen.findByRole("heading", { level: 1, name: "This page doesn't exist" }),
    ).toBeInTheDocument();
  });

  it("sends a signed-out visitor to /login", async () => {
    server.use(
      http.get("*/api/v1/auth/me", () =>
        HttpResponse.json(
          { type: "about:blank", title: "Unauthorized", status: 401, request_id: "r1" },
          { status: 401, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    const { router } = renderApp("/budget");
    await screen.findByLabelText("Email");
    expect(router.state.location.pathname).toBe("/login");
  });
});
