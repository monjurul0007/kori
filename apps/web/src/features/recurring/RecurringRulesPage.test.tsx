import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const user = {
  id: "u1",
  email: "m@example.com",
  display_name: "D",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};
const cat = {
  id: "c1",
  name: "Housing",
  kind: "expense",
  icon: null,
  color: null,
  sort_order: 1,
  archived_at: null,
  archived: false,
};

type RuleOut = Record<string, unknown>;
const makeRule = (over: Partial<RuleOut> = {}): RuleOut => ({
  id: "r1",
  name: "Rent",
  type: "expense",
  amount: "15000.00",
  category: { id: "c1", name: "Housing", kind: "expense" },
  payment_method: null,
  merchant: null,
  note: null,
  frequency: "monthly",
  interval: 1,
  start_on: "2026-12-01",
  end_on: null,
  next_due_on: "2026-12-01",
  upcoming: ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01"],
  status: "active",
  paused_at: null,
  last_error: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...over,
});

function mockApi(initial: RuleOut[]) {
  let rules = initial;
  const calls = { posts: [] as unknown[], deletes: [] as string[], transactionsFetched: 0 };
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", () => HttpResponse.json([cat])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([])),
    http.get("*/api/v1/recurring-rules", () => HttpResponse.json(rules)),
    http.post("*/api/v1/recurring-rules", async ({ request }) => {
      const body = (await request.json()) as RuleOut;
      calls.posts.push(body);
      const created = makeRule({
        ...body,
        id: "new",
        category: { id: "c1", name: "Housing", kind: "expense" },
      });
      rules = [...rules, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.post("*/api/v1/recurring-rules/:id/pause", ({ params }) => {
      rules = rules.map((r) => (r.id === params.id ? { ...r, status: "paused" } : r));
      return HttpResponse.json(rules.find((r) => r.id === params.id));
    }),
    http.post("*/api/v1/recurring-rules/:id/resume", ({ params }) => {
      rules = rules.map((r) => (r.id === params.id ? { ...r, status: "active" } : r));
      return HttpResponse.json(rules.find((r) => r.id === params.id));
    }),
    http.delete("*/api/v1/recurring-rules/:id", ({ params }) => {
      calls.deletes.push(String(params.id));
      rules = rules.filter((r) => r.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

describe("RecurringRulesPage", () => {
  it("creates a monthly rule and shows it under Active with its next date", async () => {
    const calls = mockApi([]);
    renderApp("/settings/recurring");
    await userEvent.click(await screen.findByRole("button", { name: /Add rule/ }));
    await userEvent.type(screen.getByLabelText("Name"), "Rent");
    await userEvent.type(screen.getByLabelText(/^Amount/), "15000");
    await userEvent.click(await screen.findByRole("radio", { name: "Housing" }));
    const start = screen.getByLabelText("Start date");
    await userEvent.clear(start);
    await userEvent.type(start, "2026-12-01");
    expect(screen.getByText("Monthly on the 1st")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(calls.posts).toEqual([
        {
          name: "Rent",
          type: "expense",
          amount: "15000",
          category_id: "c1",
          payment_method_id: null,
          merchant: null,
          note: null,
          frequency: "monthly",
          interval: 1,
          start_on: "2026-12-01",
          end_on: null,
        },
      ]),
    );
    const next = await screen.findByRole("list", { name: "Next dates" });
    expect(within(next).getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    const active = (await screen.findByRole("heading", { name: "Active" })).closest("section")!;
    expect(within(active).getByText("Rent")).toBeInTheDocument();
    expect(within(active).getByText(/Next: .*1 Dec/)).toBeInTheDocument();
  });

  it("pauses a rule into Paused and resumes it back", async () => {
    mockApi([makeRule()]);
    renderApp("/settings/recurring");
    await userEvent.click(await screen.findByRole("button", { name: "Pause Rent" }));
    const paused = (await screen.findByRole("heading", { name: "Paused" })).closest("section")!;
    expect(within(paused).getByText("Rent")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Resume Rent" }));
    const active = (await screen.findByRole("heading", { name: "Active" })).closest("section")!;
    expect(within(active).getByText("Rent")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Paused" })).not.toBeInTheDocument();
  });

  it("asks before deleting, then removes the row", async () => {
    const calls = mockApi([makeRule()]);
    renderApp("/settings/recurring");
    await userEvent.click(await screen.findByRole("button", { name: "Delete Rent" }));
    expect(screen.getByText("Past transactions are kept.")).toBeInTheDocument();
    expect(calls.deletes).toEqual([]);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(calls.deletes).toEqual(["r1"]));
    await waitFor(() => expect(screen.queryByText("Rent")).not.toBeInTheDocument());
  });

  it("shows last_error in red", async () => {
    mockApi([makeRule({ status: "paused", last_error: "category archived" })]);
    renderApp("/settings/recurring");
    const error = await screen.findByText("Paused: category archived");
    expect(error).toHaveClass("text-over");
  });

  it("maps a server 422 to the matching field", async () => {
    mockApi([]);
    server.use(
      http.post("*/api/v1/recurring-rules", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Unprocessable",
            status: 422,
            detail: "Invalid",
            errors: [{ loc: ["body", "amount"], msg: "Too many decimals" }],
          },
          { status: 422, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp("/settings/recurring");
    await userEvent.click(await screen.findByRole("button", { name: /Add rule/ }));
    await userEvent.type(screen.getByLabelText("Name"), "Rent");
    await userEvent.type(screen.getByLabelText(/^Amount/), "15000");
    await userEvent.click(await screen.findByRole("radio", { name: "Housing" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const message = await screen.findByText("Too many decimals");
    expect(message.id).toBe(screen.getByLabelText(/^Amount/).getAttribute("aria-describedby"));
  });

  it("opens the editor for ?rule=<id>", async () => {
    mockApi([makeRule()]);
    renderApp("/settings/recurring?rule=r1");
    expect(await screen.findByRole("heading", { name: "Edit rule" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Rent");
  });
});
