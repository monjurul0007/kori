import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { addMonths, monthOf, todayInDhaka } from "@/lib/dates";
import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const THIS_MONTH = monthOf(todayInDhaka());
const user = {
  id: "u1",
  email: "m@example.com",
  display_name: "D",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};
const food = { id: "c1", name: "Food", kind: "expense", archived: false };
const rent = { id: "c2", name: "Rent", kind: "expense", archived: false };

const catOut = (c: { id: string; name: string }) => ({
  ...c,
  kind: "expense",
  icon: null,
  color: null,
  sort_order: 1,
  archived_at: null,
});

interface Setup {
  overall?: { limit: string; source: "set" | "sum_of_categories"; spent?: string } | null;
  budgeted?: { cat: typeof food; limit: string; spent: string; percent: string; level: string }[];
  spending?: { cat: typeof food; amount: string }[];
}

function mockApi({ overall = null, budgeted = [], spending = [] }: Setup = {}) {
  const puts: unknown[] = [];
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/reports/budget-status", ({ request }) =>
      HttpResponse.json({
        month: new URL(request.url).searchParams.get("month"),
        days_elapsed: 10,
        days_in_month: 30,
        days_left: 20,
        unbudgeted: { spent: "0.00" },
        overall: overall && {
          limit: overall.limit,
          limit_source: overall.source,
          spent: overall.spent ?? "0.00",
          remaining: overall.limit,
          percent: "0.0",
          level: "ok",
        },
        categories: budgeted.map((b) => ({
          category: b.cat,
          limit: b.limit,
          spent: b.spent,
          remaining: (Number(b.limit) - Number(b.spent)).toFixed(2),
          percent: b.percent,
          level: b.level,
        })),
      }),
    ),
    http.get("*/api/v1/budgets", ({ request }) =>
      HttpResponse.json({
        month: new URL(request.url).searchParams.get("month"),
        overall:
          overall?.source === "set"
            ? { amount: overall.limit, effective_from: `${THIS_MONTH}-01` }
            : null,
        categories: budgeted.map((b) => ({
          category: b.cat,
          amount: b.limit,
          effective_from: "2026-03-01",
        })),
      }),
    ),
    http.get("*/api/v1/reports/spending", () =>
      HttpResponse.json({
        by_category: spending.map((s) => ({
          category: s.cat,
          amount: s.amount,
          count: 1,
          percent: "10.0",
        })),
        total: "0.00",
        count: 0,
      }),
    ),
    http.get("*/api/v1/categories", () => HttpResponse.json([catOut(food), catOut(rent)])),
    http.put("*/api/v1/budgets", async ({ request }) => {
      puts.push(await request.json());
      return HttpResponse.json({ month: THIS_MONTH, overall: null, categories: [] });
    }),
  );
  return puts;
}

describe("BudgetsPage", () => {
  it("goes from the page h1 to h2 card titles without skipping a level", async () => {
    mockApi({ spending: [{ cat: rent, amount: "12000.00" }] });
    renderApp("/budgets");
    await screen.findByRole("heading", { level: 2, name: "No budget yet" });
    expect(screen.getByRole("heading", { level: 2, name: "Category budgets" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("sets a category budget with PUT and refreshes", async () => {
    const puts = mockApi({ spending: [{ cat: rent, amount: "12000.00" }] });
    renderApp("/budgets");
    const group = (await screen.findByRole("heading", { name: "No budget yet" })).closest(
      "div",
    )!.parentElement!;
    expect(await within(group).findByText("৳12,000 spent")).toBeInTheDocument();

    await userEvent.click(within(group).getByRole("button", { name: "Set Rent budget" }));
    expect(screen.getByText(/Applies from .* onward/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "৫,০০০.৫");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(puts).toEqual([{ month: THIS_MONTH, category_id: "c2", amount: "5000.50" }]),
    );
  });

  it("shows the budgeted row with spent of limit and what is left", async () => {
    mockApi({
      budgeted: [{ cat: food, limit: "5000.00", spent: "1000.00", percent: "20.0", level: "ok" }],
    });
    renderApp("/budgets");
    expect(await screen.findByText("৳1,000 of ৳5,000")).toBeInTheDocument();
    expect(screen.getByText("৳4,000 left")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Food budget used" })).toHaveAttribute(
      "aria-valuetext",
      "20% used",
    );
  });

  it.each([
    ["79.0", "800.00", "৳200 left", "bg-primary"],
    ["85.0", "850.00", "৳150 left", "bg-accent"],
    ["100.0", "1000.00", "Fully used", "bg-primary"],
    ["120.0", "1200.00", "৳200 over", "bg-over"],
  ])("shows %s%% as %s in words, on a %s bar", async (percent, spent, text, bar) => {
    mockApi({ budgeted: [{ cat: food, limit: "1000.00", spent, percent, level: "ok" }] });
    renderApp("/budgets");
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Food budget used" }).firstChild).toHaveClass(
      bar,
    );
  });

  it("sets the overall limit with a null category and shows the category sum when unset", async () => {
    const puts = mockApi({ overall: { limit: "8000.00", source: "sum_of_categories" } });
    renderApp("/budgets");
    expect(await screen.findByText(/Adding up your category budgets/)).toBeInTheDocument();
    expect(screen.getByText(/left of ৳8,000/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change limit" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "9000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(puts).toEqual([{ month: THIS_MONTH, category_id: null, amount: "9000" }]),
    );
  });

  async function openRemoveConfirm() {
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food budget" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove budget" }));
  }

  const budgetedFood = {
    budgeted: [{ cat: food, limit: "5000.00", spent: "0.00", percent: "0.0", level: "ok" }],
  };

  it("asks before removing a budget and sends nothing until confirmed", async () => {
    const puts = mockApi(budgetedFood);
    renderApp("/budgets");
    await openRemoveConfirm();

    expect(screen.getByText(/Remove the Food budget from .* onward\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(puts).toEqual([]);
  });

  it("keeps the budget when the removal is cancelled", async () => {
    const puts = mockApi(budgetedFood);
    renderApp("/budgets");
    await openRemoveConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Remove budget" })).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it("removes a confirmed budget with a null amount and offers Undo", async () => {
    const puts = mockApi(budgetedFood);
    renderApp("/budgets");
    await openRemoveConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(puts).toEqual([{ month: THIS_MONTH, category_id: "c1", amount: null }]),
    );
    expect(await screen.findByText("Removed the Food budget")).toBeInTheDocument();
  });

  it("restores the previous amount for the same month when Undo is pressed", async () => {
    const puts = mockApi(budgetedFood);
    renderApp("/budgets");
    await openRemoveConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    // fireEvent: sonner's swipe handling needs setPointerCapture, which jsdom lacks.
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(puts).toEqual([
        { month: THIS_MONTH, category_id: "c1", amount: null },
        { month: THIS_MONTH, category_id: "c1", amount: "5000.00" },
      ]),
    );
  });

  it("confirms a saved category budget with a toast", async () => {
    mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Budget for Food set to ৳2,500")).toBeInTheDocument();
  });

  it("confirms a saved overall limit with a toast", async () => {
    mockApi();
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set a monthly budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "40000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Overall budget set to ৳40,000")).toBeInTheDocument();
  });

  it("shows the word Overall once on the overall card", async () => {
    mockApi({ overall: { limit: "8000.00", source: "set" } });
    renderApp("/budgets");
    await screen.findByText(/left of ৳8,000/);

    expect(screen.getAllByText("Overall")).toHaveLength(1);
  });

  it("hides the edit controls for a past month", async () => {
    mockApi({
      budgeted: [{ cat: food, limit: "5000.00", spent: "0.00", percent: "0.0", level: "ok" }],
    });
    renderApp(`/budgets?month=${addMonths(THIS_MONTH, -1)}`);
    expect(await screen.findByText(/Past months are read-only/)).toBeInTheDocument();
    await screen.findByText("৳0 of ৳5,000");
    expect(screen.queryByRole("button", { name: /Edit .* budget/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a category budget" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change limit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set .* budget/ })).not.toBeInTheDocument();
  });

  it("rejects a bad amount without calling the API", async () => {
    const puts = mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "12.345");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText(/Monthly limit/)).toHaveAccessibleDescription(
      /Use up to 2 decimal places/,
    );
    expect(puts).toEqual([]);
  });

  it.each([
    ["0", "Must be above zero"],
    ["-100", "Must be above zero"],
    ["99999999999999", "That's more than ৳1,00,00,00,00,000"],
  ])("explains why the limit %s can't be saved", async (typed, message) => {
    const puts = mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), typed);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByLabelText(/Monthly limit/)).toHaveAttribute("aria-invalid", "true");
    expect(puts).toEqual([]);
  });

  it("shows a server 422 under the amount field", async () => {
    mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    server.use(
      http.put("*/api/v1/budgets", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Validation error",
            status: 422,
            detail: "Invalid",
            errors: [{ loc: ["body", "amount"], msg: "Amount is too large" }],
          },
          { status: 422, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const field = screen.getByLabelText(/Monthly limit/);
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(field).toHaveAccessibleDescription(/Amount is too large/);
  });
});

describe("BudgetsPage edge cases", () => {
  it("uses the month in the URL for every request", async () => {
    mockApi();
    const months: string[] = [];
    server.use(
      http.get("*/api/v1/budgets", ({ request }) => {
        months.push(new URL(request.url).searchParams.get("month") ?? "");
        return HttpResponse.json({ month: "", overall: null, categories: [] });
      }),
    );
    const month = addMonths(THIS_MONTH, 2);
    renderApp(`/budgets?month=${month}`);
    await screen.findByRole("heading", { name: "Category budgets" });
    expect(months).toContain(month);
    // A future month is editable, so there is no read-only note.
    expect(screen.queryByText(/Past months are read-only/)).not.toBeInTheDocument();
  });

  it("falls back to the current month for a bad ?month=", async () => {
    mockApi();
    renderApp("/budgets?month=nonsense");
    await screen.findByRole("heading", { name: "Category budgets" });
    expect(screen.queryByText(/nonsense/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
  });

  it("offers to set an overall limit when none is set and no category has a budget", async () => {
    mockApi();
    renderApp("/budgets");
    expect(await screen.findByRole("button", { name: "Set a monthly budget" })).toBeInTheDocument();
    expect(screen.getByText("No category budgets yet.")).toBeInTheDocument();
  });

  it("shows an over-budget row as over, with the amount over", async () => {
    mockApi({
      budgeted: [
        { cat: food, limit: "1000.00", spent: "1200.00", percent: "120.0", level: "over" },
      ],
    });
    renderApp("/budgets");
    expect(await screen.findByText("৳1,200 of ৳1,000")).toBeInTheDocument();
    expect(screen.getByText("৳200 over")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Food budget used" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "120% used");
  });

  it("shows the sheet copy for the chosen month", async () => {
    mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/Food budget/);
    expect(screen.getByText(/Applies from .* onward/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove budget" })).not.toBeInTheDocument();
  });

  it("refreshes the dashboard's budget status after saving", async () => {
    mockApi({ spending: [{ cat: food, amount: "500.00" }] });
    let statusCalls = 0;
    server.use(
      http.get("*/api/v1/reports/budget-status", () => {
        statusCalls += 1;
        return HttpResponse.json({
          month: THIS_MONTH,
          days_elapsed: 1,
          days_in_month: 30,
          days_left: 29,
          unbudgeted: { spent: "0.00" },
          overall: null,
          categories: [],
        });
      }),
    );
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Set Food budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "100");
    const before = statusCalls;
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(statusCalls).toBeGreaterThan(before));
  });
});

describe("BudgetsPage redesign", () => {
  const budgetedFoodAndRent = {
    budgeted: [
      { cat: rent, limit: "15000.00", spent: "7500.00", percent: "50.0", level: "ok" },
      { cat: food, limit: "3000.00", spent: "3150.00", percent: "105.0", level: "over" },
    ],
  };

  it("lists the over-budget category before the others", async () => {
    mockApi(budgetedFoodAndRent);
    renderApp("/budgets");
    await screen.findByText("৳150 over");
    const names = screen.getAllByRole("progressbar", { name: /budget used$/ });
    expect(names.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "Food budget used",
      "Rent budget used",
    ]);
  });

  it("shows the hero with what is left, the budget and the spending", async () => {
    mockApi({ overall: { limit: "40000.00", source: "set", spent: "27350.00" } });
    renderApp("/budgets");
    const hero = await screen.findByRole("region", { name: "Monthly budget" });
    expect(hero).toHaveTextContent("৳40,000");
    expect(hero).toHaveTextContent("৳27,350 spent");
    expect(within(hero).getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0% used");
  });

  it("offers a way to set a monthly budget when there is none", async () => {
    mockApi();
    renderApp("/budgets");
    const hero = await screen.findByRole("region", { name: "Monthly budget" });
    expect(within(hero).getByRole("button", { name: "Set a monthly budget" })).toBeVisible();
  });

  it("counts the categories with no spending instead of listing them", async () => {
    mockApi({ spending: [{ cat: rent, amount: "12000.00" }] });
    renderApp("/budgets");
    expect(await screen.findByText("1 more category has no spending this month.")).toBeVisible();
  });

  it("adds a category budget by choosing a category that has no budget yet", async () => {
    const puts = mockApi({
      budgeted: [{ cat: rent, limit: "15000.00", spent: "0.00", percent: "0.0", level: "ok" }],
    });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Add a category budget" }));
    const category = screen.getByLabelText("Category");
    expect(
      within(category)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Choose a category", "Food"]);
    await userEvent.selectOptions(category, "Food");
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(puts).toEqual([{ month: THIS_MONTH, category_id: "c1", amount: "2500" }]),
    );
  });

  it("asks for a category before saving an added budget", async () => {
    const puts = mockApi();
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Add a category budget" }));
    await userEvent.type(screen.getByLabelText(/Monthly limit/), "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Category")).toHaveAccessibleDescription("Choose a category");
    expect(puts).toEqual([]);
  });
});

describe("BudgetsPage hero states", () => {
  it("shows an overspent overall as the amount over, with no daily allowance", async () => {
    mockApi({ overall: { limit: "1000.00", source: "set", spent: "1200.00" } });
    server.use(
      http.get("*/api/v1/reports/budget-status", () =>
        HttpResponse.json({
          month: THIS_MONTH,
          days_elapsed: 10,
          days_in_month: 30,
          days_left: 20,
          unbudgeted: { spent: "0.00" },
          overall: {
            limit: "1000.00",
            limit_source: "set",
            spent: "1200.00",
            remaining: "-200.00",
            percent: "120.0",
            level: "over",
          },
          categories: [],
        }),
      ),
    );
    renderApp("/budgets");
    const hero = await screen.findByRole("region", { name: "Monthly budget" });
    expect(hero).toHaveTextContent("৳200over ৳1,000");
    expect(hero).not.toHaveTextContent(/Spend up to/);
    expect(within(hero).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the days left and a daily allowance for the current month", async () => {
    mockApi({ overall: { limit: "40000.00", source: "set", spent: "0.00" } });
    renderApp("/budgets");
    const hero = await screen.findByRole("region", { name: "Monthly budget" });
    expect(hero).toHaveTextContent("20 days left");
    expect(hero).toHaveTextContent("Spend up to ৳2,000 a day to stay on budget.");
  });

  it("hides the days left and the daily allowance for another month", async () => {
    mockApi({ overall: { limit: "40000.00", source: "set", spent: "0.00" } });
    renderApp(`/budgets?month=${addMonths(THIS_MONTH, 1)}`);
    const hero = await screen.findByRole("region", { name: "Monthly budget" });
    expect(hero).toHaveTextContent("৳40,000");
    expect(hero).not.toHaveTextContent(/days? left/);
    expect(hero).not.toHaveTextContent(/Spend up to/);
  });
});

describe("BudgetsPage remove confirm", () => {
  it("backs out of the remove confirm on Escape without closing the sheet", async () => {
    const puts = mockApi({
      budgeted: [{ cat: food, limit: "5000.00", spent: "0.00", percent: "0.0", level: "ok" }],
    });
    renderApp("/budgets");
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food budget" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove budget" }));
    expect(screen.getByRole("group", { name: "Confirm removal" })).toBeVisible();

    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove budget" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Confirm removal" })).not.toBeInTheDocument();
    expect(puts).toEqual([]);
  });
});
