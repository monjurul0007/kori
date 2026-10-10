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

describe("transaction form", () => {
  it("logs an expense with amount, category, save", async () => {
    const state = mockApi();
    renderApp(`/transactions?month=${month}`);
    await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "1,250.5");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Food & Dining" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    expect(state.posted[0]).toMatchObject({
      type: "expense",
      amount: "1250.50",
      category_id: "c-food",
      occurred_on: today,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Shop new")).toBeInTheDocument();
  });

  it("edits the amount of a row", async () => {
    const state = mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    const amount = await screen.findByLabelText("Amount (৳)");
    expect(amount).toHaveValue("250");
    await userEvent.clear(amount);
    await userEvent.type(amount, "300");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.put).toHaveLength(1));
    expect(state.put[0]).toMatchObject({ amount: "300", category_id: "c-food" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await screen.findAllByText("৳300")).length).toBeGreaterThan(0);
  });

  it("asks before deleting, then removes the row", async () => {
    const state = mockApi([makeTx("a", { occurred_on: today })]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop a"));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(state.deleted).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(state.deleted).toEqual(["a"]));
    await waitFor(() => expect(screen.queryByText("Shop a")).not.toBeInTheDocument());
  });

  it("shows a server 422 under the matching field", async () => {
    mockApi();
    server.use(
      http.post("*/api/v1/transactions", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Unprocessable Content",
            status: 422,
            detail: "Request validation failed",
            request_id: "r1",
            errors: [
              {
                loc: ["body", "occurred_on"],
                msg: "Date must be in the past",
                type: "value_error",
              },
            ],
          },
          { status: 422, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp(`/transactions?month=${month}`);
    await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "10");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Bills" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    const error = await within(dialog).findByText("Date must be in the past");
    expect(within(dialog).getByLabelText("Date")).toHaveAccessibleDescription(
      "Date must be in the past",
    );
    expect(error).toBeInTheDocument();
  });

  it("opens a split read-only with the M2 message", async () => {
    const state = mockApi([
      makeTx("s", {
        occurred_on: today,
        amount: "150",
        is_split: true,
        lines: [
          { category: food, amount: "100", category_source: "user" },
          { category: bills, amount: "50", category_source: "user" },
        ],
      }),
    ]);
    renderApp(`/transactions?month=${month}`);
    await userEvent.click(await screen.findByText("Shop s"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Split editing arrives in M2")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Amount (৳)")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Merchant"), "!");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.put).toHaveLength(1));
    expect(state.put[0]).toMatchObject({
      amount: "150",
      lines: [
        { category_id: "c-food", amount: "100" },
        { category_id: "c-bills", amount: "50" },
      ],
    });
    expect(state.put[0]).not.toHaveProperty("category_id");
  });

  it("autocompletes tags and creates new ones on Enter", async () => {
    const state = mockApi();
    renderApp(`/transactions?month=${month}`);
    await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "5");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Bills" }));
    const tags = within(dialog).getByLabelText("Tags");
    await userEvent.type(tags, "ei");
    await userEvent.click(await within(dialog).findByRole("button", { name: "#eid" }));
    await userEvent.type(tags, "newtag{Enter}");
    expect(within(dialog).getByText("#newtag")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.posted).toHaveLength(1));
    expect(state.posted[0]).toMatchObject({ tags: ["eid", "newtag"] });
  });

  it("rejects an empty form without calling the API", async () => {
    const state = mockApi();
    renderApp(`/transactions?month=${month}`);
    await userEvent.click((await screen.findAllByRole("button", { name: "Add transaction" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter an amount like 1,250.50")).toBeInTheDocument();
    expect(within(dialog).getByText("Pick a category")).toBeInTheDocument();
    expect(state.posted).toHaveLength(0);
  });
});
