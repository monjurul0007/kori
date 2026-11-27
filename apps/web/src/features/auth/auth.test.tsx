import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";
import { renderApp } from "@/test/renderApp";

import { safeNext } from "./utils";

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

describe("login form accessibility", () => {
  it("links each field error to its input and focuses the first invalid field", async () => {
    server.use(loggedOut());
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    const email = screen.getByLabelText("Email");
    const emailError = await screen.findByText("Enter your email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", emailError.id);
    expect(emailError.id).not.toBe("");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute(
      "aria-describedby",
      screen.getByText("Enter your password").id,
    );
    expect(email).toHaveFocus();
  });

  it("does not mark untouched fields as invalid", async () => {
    server.use(loggedOut());
    renderApp("/login");
    expect(await screen.findByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-describedby");
  });

  it("asks for a real email address", async () => {
    server.use(loggedOut());
    renderApp("/login");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("Email"), "not-an-email");
    await u.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("That doesn't look like an email address")).toBeInTheDocument();
  });

  it("shows friendly copy for over-long values", async () => {
    server.use(loggedOut());
    renderApp("/login");
    const u = userEvent.setup();
    await u.click(await screen.findByLabelText("Email"));
    await u.paste(`${"a".repeat(310)}@example.com`);
    await u.click(screen.getByLabelText("Password"));
    await u.paste("p".repeat(1025));
    await u.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Email is too long")).toBeInTheDocument();
    expect(screen.getByText("Password is too long")).toBeInTheDocument();
  });

  it("toggles password visibility without submitting", async () => {
    let posted = false;
    server.use(
      loggedOut(),
      http.post("*/api/v1/auth/login", () => {
        posted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/login");
    const u = userEvent.setup();
    const password = await screen.findByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(password).toHaveAttribute("type", "password");
    await u.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await u.click(toggle);
    expect(password).toHaveAttribute("type", "password");
    expect(posted).toBe(false);
  });

  it("explains how to recover a forgotten password", async () => {
    server.use(loggedOut());
    renderApp("/login");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Forgot password?" }));
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Kori doesn't send reset emails. Ask whoever runs your Kori server to reset your password.",
      ),
    ).toBeVisible();
  });

  it("has a Log in heading for screen readers", async () => {
    server.use(loggedOut());
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("autofocuses the email field and shows the brand panel", async () => {
    server.use(loggedOut());
    renderApp("/login");
    expect(await screen.findByLabelText("Email")).toHaveFocus();
    expect(screen.getByText("Every taka, accounted for.")).toBeInTheDocument();
    expect(screen.getByText("কড়ি")).toHaveAttribute("lang", "bn");
  });
});

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
    expect(await screen.findByText("me@example.com")).toBeInTheDocument();
  });

  it("lands on the dashboard when there is no next", async () => {
    let signedIn = false;
    server.use(
      http.get("*/api/v1/auth/me", () =>
        signedIn ? HttpResponse.json(user) : problem(401, "Unauthorized", "Not signed in"),
      ),
      http.post("*/api/v1/auth/login", () => {
        signedIn = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("*/api/v1/reports/*", () => HttpResponse.json({}, { status: 500 })),
      http.get("*/api/v1/transactions", () =>
        HttpResponse.json({ items: [], next_cursor: null, totals: {} }),
      ),
    );
    const { router } = renderApp("/login");
    await fillAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
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

  it("redirects / to the dashboard inside the shell", async () => {
    server.use(
      loggedIn(),
      http.get("*/api/v1/reports/*", () => HttpResponse.json({}, { status: 500 })),
      http.get("*/api/v1/transactions", () =>
        HttpResponse.json({ items: [], next_cursor: null, totals: {} }),
      ),
    );
    const { router } = renderApp("/");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
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
    expect(await screen.findByRole("dialog")).toHaveTextContent("New expense");
  });
});

describe("safeNext", () => {
  it.each([
    ["/settings", "/settings"],
    ["//evil.example", "/dashboard"],
    ["https://evil.example", "/dashboard"],
    [null, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
