import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

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
    const confirm = await screen.findByRole("alertdialog", { name: "Discard this transaction?" });
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
    await userEvent.type(within(dialog).getByLabelText("Tags"), "eid");
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes without asking after a successful save", async () => {
    const state = mockApi();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "300");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Food & Dining" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the actions in a footer outside the scrolling body", async () => {
    mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const dialog = await screen.findByRole("dialog");
    const body = within(dialog).getByTestId("form-body");
    const footer = within(dialog).getByTestId("form-footer");
    expect(body).toHaveClass("overflow-y-auto");
    expect(body).not.toContainElement(footer);
    for (const name of ["Save", "Delete"]) {
      const button = within(dialog).getByRole("button", { name });
      expect(footer).toContainElement(button);
      expect(body).not.toContainElement(button);
    }
  });
});
