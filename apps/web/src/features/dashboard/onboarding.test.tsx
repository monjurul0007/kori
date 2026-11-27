import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";
import { installStore } from "@/pwa/installStore";

import { bills, food, makeTx } from "../transactions/fixtures";
import { REPORTS_KEY } from "./hooks";
import { CATEGORIES_REVIEWED_KEY, ONBOARDING_HIDDEN_KEY } from "./onboardingKeys";

const user = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

const overallBudget = {
  limit: "20000",
  limit_source: "set",
  spent: "0",
  remaining: "20000",
  percent: "0.0",
  level: "ok",
};

function mockApi({ transactions = 0, hasBudget = false } = {}) {
  const state = { transactions, hasBudget };
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () => HttpResponse.json([food, bills])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([])),
    http.get("*/api/v1/tags", () => HttpResponse.json([])),
    http.get("*/api/v1/reports/budget-status", () =>
      HttpResponse.json({
        month: "2026-09",
        days_in_month: 30,
        days_elapsed: 1,
        days_left: 29,
        overall: state.hasBudget ? overallBudget : null,
        categories: [],
        unbudgeted: { spent: "0" },
      }),
    ),
    http.get("*/api/v1/reports/spending", () =>
      HttpResponse.json({
        from: "2026-09-01",
        to: "2026-09-30",
        type: "expense",
        total: "0",
        count: 0,
        by_category: [],
      }),
    ),
    http.get("*/api/v1/reports/trend", () => HttpResponse.json({ months: [] })),
    http.get("*/api/v1/transactions", () =>
      HttpResponse.json({
        items: Array.from({ length: state.transactions }, (_, i) => makeTx(`t${i}`)),
        next_cursor: null,
        totals: { expense: "0", income: "0", count: state.transactions },
      }),
    ),
  );
  return state;
}

const welcome = () => screen.findByRole("heading", { name: "Welcome to Kori" });

afterEach(() => {
  localStorage.clear();
  installStore.reset();
  vi.restoreAllMocks();
});

describe("first-run dashboard", () => {
  it("shows the checklist and one placeholder instead of the empty cards", async () => {
    mockApi();
    renderApp("/dashboard");
    await welcome();
    expect(screen.getByText("Your spending will show here")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Where it went" })).not.toBeInTheDocument();
    expect(screen.getByText("Three steps and your month is set up.")).toBeInTheDocument();
  });

  it("ticks the first-expense step once a transaction exists, without a reload", async () => {
    const state = mockApi();
    const { client } = renderApp("/dashboard");
    await welcome();
    expect(screen.getByRole("button", { name: "Add your first expense" })).toBeInTheDocument();

    state.transactions = 1;
    await act(() => client.invalidateQueries({ queryKey: REPORTS_KEY }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add your first expense" })).toBeNull(),
    );
    expect(screen.getByText("Add your first expense")).toHaveClass("line-through");
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.queryByText("Your spending will show here")).not.toBeInTheDocument();
  });

  it("opens the add-expense sheet from the Add button", async () => {
    mockApi();
    renderApp("/dashboard");
    await welcome();
    await userEvent.click(screen.getByRole("button", { name: "Add your first expense" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("ticks the budget step when an overall budget is set", async () => {
    mockApi({ transactions: 1, hasBudget: true });
    renderApp("/dashboard");
    await welcome();
    expect(screen.getByText("Set a monthly budget")).toHaveClass("line-through");
    expect(screen.getByText("Add your first expense")).toHaveClass("line-through");
    expect(screen.getByText("Check your categories")).not.toHaveClass("line-through");
  });

  it("ticks the categories step once the Categories page was visited", async () => {
    mockApi({ transactions: 1 });
    const { router } = renderApp("/settings/categories");
    await waitFor(() => expect(localStorage.getItem(CATEGORIES_REVIEWED_KEY)).toBe("1"));
    await act(() => router.navigate("/dashboard"));
    await welcome();
    expect(screen.getByText("Check your categories")).toHaveClass("line-through");
  });

  it("hides the card when Hide is pressed and keeps it hidden", async () => {
    mockApi({ transactions: 1 });
    const { unmount } = (() => {
      const result = renderApp("/dashboard");
      return { unmount: () => result.router.dispose() };
    })();
    await welcome();
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("heading", { name: "Welcome to Kori" })).not.toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_HIDDEN_KEY)).toBe("1");
    unmount();
  });

  it("stays hidden on a later visit once dismissed", async () => {
    localStorage.setItem(ONBOARDING_HIDDEN_KEY, "1");
    mockApi({ transactions: 1 });
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to Kori" })).not.toBeInTheDocument();
  });

  it("disappears by itself when every step is done", async () => {
    localStorage.setItem(CATEGORIES_REVIEWED_KEY, "1");
    mockApi({ transactions: 1, hasBudget: true });
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to Kori" })).not.toBeInTheDocument();
  });

  it("offers the install step only where Kori can be installed", async () => {
    mockApi();
    renderApp("/dashboard");
    await welcome();
    expect(screen.queryByText("Install Kori on this phone")).not.toBeInTheDocument();

    const prompt = vi.fn().mockResolvedValue(undefined);
    act(() =>
      installStore.set({
        deferred: Object.assign(new Event("beforeinstallprompt"), {
          prompt,
          userChoice: Promise.resolve({ outcome: "accepted" as const }),
        }),
      }),
    );
    const install = await screen.findByRole("button", { name: "Install Kori on this phone" });
    await userEvent.click(install);
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("still renders when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mockApi();
    renderApp("/dashboard");
    await welcome();
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("heading", { name: "Welcome to Kori" })).not.toBeInTheDocument();
  });

  it("keeps the normal dashboard when the transaction lookup fails", async () => {
    mockApi();
    server.use(http.get("*/api/v1/transactions", () => HttpResponse.json({}, { status: 500 })));
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.queryByText("Your spending will show here")).not.toBeInTheDocument();
  });

  it("marks done steps for screen readers", async () => {
    mockApi({ transactions: 1 });
    renderApp("/dashboard");
    await welcome();
    const loginRow = screen.getByText("Log in").closest("li")!;
    expect(within(loginRow).getByText("(done)")).toBeInTheDocument();
  });
});
