import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import { todayInDhaka } from "@/lib/dates";
import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

import { bills, food, makeTx } from "../fixtures";
import type { Transaction } from "../TransactionRow";

const user = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};
const month = todayInDhaka().slice(0, 7);
const today = todayInDhaka();

function mockApi(items: Transaction[] = []) {
  const state = { items, posted: [] as unknown[], put: [] as unknown[], deleted: [] as string[] };
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () =>
      HttpResponse.json([
        { ...food, archived_at: null },
        { ...bills, archived_at: null },
      ]),
    ),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([{ id: "pm1", name: "bKash" }])),
    http.get("*/api/v1/tags", () => HttpResponse.json([{ id: "t1", name: "eid", usage_count: 2 }])),
    http.get("*/api/v1/transactions", () =>
      HttpResponse.json({
        items: state.items,
        next_cursor: null,
        totals: { expense: "0", income: "0", count: state.items.length },
      }),
    ),
    http.post("*/api/v1/transactions", async ({ request }) => {
      const body = (await request.json()) as Record<string, string>;
      state.posted.push(body);
      state.items = [
        makeTx("new", { amount: body.amount ?? "0", occurred_on: today }),
        ...state.items,
      ];
      return HttpResponse.json(state.items[0], { status: 201 });
    }),
    http.put("*/api/v1/transactions/:id", async ({ request }) => {
      const body = (await request.json()) as Record<string, string>;
      state.put.push(body);
      state.items = state.items.map((t) => ({ ...t, amount: body.amount ?? t.amount }));
      return HttpResponse.json(state.items[0]);
    }),
    http.delete("*/api/v1/transactions/:id", ({ params }) => {
      state.deleted.push(String(params.id));
      state.items = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

afterEach(() => {
  // Saving remembers the payment method, which must not pre-pick one in the next test.
  localStorage.clear();
});

async function openAdd() {
  renderApp(`/transactions?month=${month}`);
  await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
  return screen.findByRole("dialog");
}

describe("discard guard", () => {
  it("asks before closing a dirty form on Esc and keeps the input", async () => {
    mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "77");
    await userEvent.keyboard("{Escape}");
    const confirm = await screen.findByRole("alertdialog", { name: "Discard changes?" });
    expect(within(confirm).getByRole("button", { name: "Keep editing" })).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (৳)")).toHaveValue("77");
  });

  it("returns focus to the form on Keep editing", async () => {
    mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "77");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Amount (৳)")).toHaveFocus();
    expect(screen.getByLabelText("Amount (৳)")).toHaveValue("77");
  });

  it("closes and resets on Discard", async () => {
    mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "77");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
    expect(await screen.findByLabelText("Amount (৳)")).toHaveValue("");
  });

  it("closes a pristine form silently", async () => {
    mockApi();
    await openAdd();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("treats a tag typed but not confirmed as unsaved input", async () => {
    mockApi();
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tags, note or split" }));
    await userEvent.type(within(dialog).getByLabelText("Tags"), "eid");
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes without asking after a successful save", async () => {
    const state = mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "300");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Food & Dining" }));
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("editing in the quick-entry sheet", () => {
  it("edits in the same sheet, titled Edit expense, prefilled, with Save changes", async () => {
    mockApi([
      makeTx("a", { occurred_on: today, merchant: "Rickshaw", tags: ["office"], note: "Late" }),
    ]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Rickshaw"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit expense" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Amount (৳)")).toHaveValue("250");
    expect(within(dialog).getByRole("radio", { name: "Food & Dining" })).toBeChecked();
    expect(within(dialog).getByText("#office")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Note")).toHaveValue("Late");
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      within(dialog).getByText("Tags are saved in lowercase; spaces become hyphens."),
    ).toBeInTheDocument();
  });

  it("titles an income Edit income", async () => {
    mockApi([makeTx("a", { occurred_on: today, type: "income" })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    expect(await screen.findByRole("heading", { name: "Edit income" })).toBeInTheDocument();
  });

  it("puts Delete under the form on a phone, not in the footer", async () => {
    mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const dialog = await screen.findByRole("dialog");
    const footer = within(dialog).getByRole("button", { name: "Save changes" }).closest("footer");
    expect(footer).not.toContainElement(within(dialog).getByRole("button", { name: "Delete" }));
  });

  it("lets a keyboard user delete: Delete, Cancel has focus, Shift+Tab back to Delete, Tab to Confirm", async () => {
    const state = mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByRole("button", { name: "Delete" }).focus();
    await userEvent.keyboard("{Enter}");
    const confirm = within(dialog).getByRole("alertdialog", { name: "Confirm delete" });
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    expect(within(confirm).getByRole("button", { name: "Confirm delete" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(state.deleted).toEqual(["a"]));
  });

  it("disables Delete while a save is in flight", async () => {
    mockApi([makeTx("a", { occurred_on: today })]);
    server.use(
      http.put("*/api/v1/transactions/:id", async () => {
        await delay(300);
        return HttpResponse.json(makeTx("a", { occurred_on: today }));
      }),
    );
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("quick entry", () => {
  it("focuses the amount when the sheet opens", async () => {
    mockApi();
    await openAdd();
    expect(screen.getByLabelText("Amount (৳)")).toHaveFocus();
  });

  it("puts the amount in the Save label and follows the Expense/Income switch", async () => {
    mockApi();
    const dialog = await openAdd();
    expect(within(dialog).getByRole("heading", { name: "New expense" })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "320");
    expect(within(dialog).getByRole("button", { name: "Save ৳320 expense" })).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Income" }));
    expect(within(dialog).getByRole("heading", { name: "New income" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save ৳320 income" })).toBeVisible();
  });

  it("marks the chosen category as checked", async () => {
    mockApi();
    const dialog = await openAdd();
    const food = await within(dialog).findByRole("radio", { name: "Food & Dining" });
    expect(food).toHaveAttribute("aria-checked", "false");
    await userEvent.click(food);
    expect(food).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("radio", { name: "Bills" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("keeps Save in a footer outside the scrolling body", async () => {
    mockApi();
    const dialog = await openAdd();
    const save = within(dialog).getByRole("button", { name: /^Save/ });
    const footer = save.closest("footer");
    expect(footer).not.toBeNull();
    expect(footer).not.toContainElement(within(dialog).getByLabelText("Amount (৳)"));
  });

  it("saves with the date, payment method and merchant chosen from the chips", async () => {
    const state = mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "90");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Bills" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Paid with" }));
    await userEvent.selectOptions(within(dialog).getByLabelText("Paid with"), "bKash");
    await userEvent.click(within(dialog).getByRole("button", { name: "Merchant" }));
    await userEvent.type(within(dialog).getByLabelText("Merchant"), "Rickshaw");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    expect(state.posted[0]).toMatchObject({
      amount: "90",
      category_id: "c-bills",
      payment_method_id: "pm1",
      merchant: "Rickshaw",
    });
  });
});

describe("quick entry on a wide screen", () => {
  const original = window.matchMedia;
  let listeners: ((event: { matches: boolean }) => void)[] = [];
  let isWide = true;

  beforeEach(() => {
    listeners = [];
    isWide = true;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query === "(min-width: 768px)" && isWide;
      },
      media: query,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("shows date, merchant and paid-with directly, with a Cancel button", async () => {
    mockApi();
    const dialog = await openAdd();
    expect(within(dialog).getByLabelText("Date")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Merchant")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Paid with")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("puts Delete on the left of the footer when editing", async () => {
    mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const dialog = await screen.findByRole("dialog");
    const footer = within(dialog).getByRole("button", { name: "Save changes" }).closest("footer");
    const buttons = within(footer as HTMLElement).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Delete");
  });

  it("saves the directly entered fields", async () => {
    const state = mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "75");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Bills" }));
    await userEvent.type(within(dialog).getByLabelText("Merchant"), "Office lunch");
    await userEvent.selectOptions(within(dialog).getByLabelText("Paid with"), "bKash");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    expect(state.posted[0]).toMatchObject({
      amount: "75",
      category_id: "c-bills",
      merchant: "Office lunch",
      payment_method_id: "pm1",
    });
  });

  it("keeps what was typed when the screen is resized to a phone mid-entry", async () => {
    mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "75");
    await userEvent.type(within(dialog).getByLabelText("Merchant"), "Office lunch");
    isWide = false;
    act(() => listeners.forEach((listener) => listener({ matches: false })));
    expect(within(dialog).queryByLabelText("Merchant")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Office lunch" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Amount (৳)")).toHaveValue("75");
  });
});
