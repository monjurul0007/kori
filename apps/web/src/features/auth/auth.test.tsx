import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";
import { renderApp } from "@/test/renderApp";

import { safeNext } from "./session";

const user = {
  id: "7d9f6b1e-2d1c-4c57-9b0a-1d6a2e0f4a11",
  email: "me@example.com",
  display_name: "Demo User",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

const problem = (status: number, title: string, detail: string, headers = {}) =>
  HttpResponse.json(
    { type: "about:blank", title, status, detail, request_id: "r1" },
    { status, headers: { "content-type": "application/problem+json", ...headers } },
  );

const loggedOut = () =>
  http.get("*/api/v1/auth/me", () => problem(401, "Unauthorized", "Not signed in"));
const loggedIn = () => http.get("*/api/v1/auth/me", () => HttpResponse.json(user));

async function fillAndSubmit() {
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText("Email"), "me@example.com");
  await u.type(screen.getByLabelText("Password"), "hunter2hunter2");
  await u.click(screen.getByRole("button", { name: "Log in" }));
}

describe("login", () => {
  it("logs in and redirects to next", async () => {
    let signedIn = false;
    server.use(
      http.get("*/api/v1/auth/me", () =>
        signedIn ? HttpResponse.json(user) : problem(401, "Unauthorized", "Not signed in"),
      ),
      http.post("*/api/v1/auth/login", () => {
        signedIn = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp("/login?next=%2Fsettings");
    await fillAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
    expect(await screen.findByText("Demo User")).toBeInTheDocument();
  });

  it("shows a message for 401", async () => {
    server.use(
      loggedOut(),
      http.post("*/api/v1/auth/login", () => problem(401, "Unauthorized", "bad credentials")),
    );
    renderApp("/login");
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it("shows a message for 429 using Retry-After", async () => {
    server.use(
      loggedOut(),
      http.post("*/api/v1/auth/login", () =>
        problem(429, "Too Many Requests", "slow down", { "retry-after": "600" }),
      ),
    );
    renderApp("/login");
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Try again in 10 minutes",
    );
  });

  it("validates required fields", async () => {
    server.use(loggedOut());
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your email")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
  });
});

describe("route guard and logout", () => {
  it("redirects to login with next when logged out", async () => {
    server.use(loggedOut());
    const { router } = renderApp("/settings");
    await screen.findByLabelText("Email");
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Fsettings");
  });

  it("redirects / to transactions inside the shell", async () => {
    server.use(loggedIn());
    const { router } = renderApp("/");
    expect(await screen.findByRole("heading", { name: "Transactions" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/transactions");
    expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
  });

  it("logout clears the session and goes to login", async () => {
    let signedIn = true;
    server.use(
      http.get("*/api/v1/auth/me", () =>
        signedIn ? HttpResponse.json(user) : problem(401, "Unauthorized", "Not signed in"),
      ),
      http.post("*/api/v1/auth/logout", () => {
        signedIn = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp("/settings");
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(screen.queryByText("Demo User")).not.toBeInTheDocument();
  });

  it("opens the add sheet from the bottom nav", async () => {
    server.use(loggedIn());
    renderApp("/transactions");
    await screen.findByRole("heading", { name: "Transactions" });
    const add = screen.getAllByRole("button", { name: "Add transaction" })[0]!;
    await userEvent.click(add);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Add transaction");
  });
});

describe("safeNext", () => {
  it.each([
    ["/settings", "/settings"],
    ["//evil.example", "/transactions"],
    ["https://evil.example", "/transactions"],
    [null, "/transactions"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
