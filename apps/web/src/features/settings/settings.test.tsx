import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const user = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

type Cat = {
  id: string;
  name: string;
  kind: "expense" | "income";
  icon: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
};
type Pm = {
  id: string;
  name: string;
  kind: string;
  sort_order: number;
  archived_at: string | null;
};

const cat = (id: string, name: string, over: Partial<Cat> = {}): Cat => ({
  id,
  name,
  kind: "expense",
  icon: "utensils",
  color: null,
  sort_order: 10,
  archived_at: null,
  ...over,
});

/** A tiny in-memory API for categories and payment methods. */
function mockApi(
  initialCats: Cat[],
  initialPms: Pm[] = [],
  spending: { amount: string; count: number; category: { id: string } }[] = [],
) {
  const cats = [...initialCats];
  const pms = [...initialPms];
  const calls: { method: string; path: string; body: unknown }[] = [];
  const log = async (request: Request) => {
    const body =
      request.method === "GET"
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined);
    calls.push({ method: request.method, path: new URL(request.url).pathname, body });
    return body as Record<string, unknown>;
  };
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(user)),
    http.get("*/api/v1/categories", ({ request }) => {
      const all = new URL(request.url).searchParams.get("include_archived") === "true";
      return HttpResponse.json(cats.filter((c) => all || !c.archived_at));
    }),
    http.post("*/api/v1/categories", async ({ request }) => {
      const body = (await log(request)) as Omit<Cat, "id" | "archived_at">;
      if (
        cats.some((c) => c.kind === body.kind && c.name.toLowerCase() === body.name.toLowerCase())
      ) {
        return HttpResponse.json(
          { type: "about:blank", title: "Conflict", status: 409, detail: "dup", request_id: "r" },
          { status: 409, headers: { "content-type": "application/problem+json" } },
        );
      }
      const created = { ...body, id: `c${cats.length + 1}`, archived_at: null } as Cat;
      cats.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch("*/api/v1/categories/:id", async ({ request, params }) => {
      const body = await log(request);
      const c = cats.find((x) => x.id === params.id)!;
      Object.assign(c, body);
      return HttpResponse.json(c);
    }),
    http.post("*/api/v1/categories/:id/:action", async ({ request, params }) => {
      await log(request);
      const c = cats.find((x) => x.id === params.id)!;
      c.archived_at = params.action === "archive" ? "2026-09-01T00:00:00Z" : null;
      return HttpResponse.json(c);
    }),
    http.get("*/api/v1/reports/spending", () =>
      HttpResponse.json({ by_category: spending, count: 0, from: "", to: "", total: "0.00" }),
    ),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json(pms)),
    http.patch("*/api/v1/payment-methods/:id", async ({ request, params }) => {
      const body = await log(request);
      const p = pms.find((x) => x.id === params.id)!;
      Object.assign(p, body);
      return HttpResponse.json(p);
    }),
  );
  return { cats, pms, calls };
}

const names = () =>
  screen
    .getAllByRole("listitem")
    .map((li) => li.querySelector("span.break-words")?.textContent)
    .filter(Boolean);

describe("categories settings", () => {
  it("links to both pages from Settings", async () => {
    mockApi([]);
    renderApp("/settings");
    expect(await screen.findByRole("link", { name: /Categories/ })).toHaveAttribute(
      "href",
      "/settings/categories",
    );
    expect(screen.getByRole("link", { name: /Payment methods/ })).toHaveAttribute(
      "href",
      "/settings/payment-methods",
    );
  });

  it("shows only the tab's kind", async () => {
    mockApi([cat("c1", "Food"), cat("c2", "Salary", { kind: "income" })]);
    renderApp("/settings/categories");
    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Income" }));
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Food")).not.toBeInTheDocument();
  });

  it("adds a category with an icon and a color", async () => {
    const api = mockApi([cat("c1", "Food")]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Add category" }));
    await userEvent.type(screen.getByLabelText("Name"), "Coffee");
    await userEvent.click(screen.getByRole("button", { name: "coffee" }));
    await userEvent.click(screen.getByRole("button", { name: "Blue" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Coffee")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "POST")?.body).toMatchObject({
      name: "Coffee",
      kind: "expense",
      icon: "coffee",
      color: "#2563eb",
      sort_order: 20,
    });
  });

  it("renames a category", async () => {
    const api = mockApi([cat("c1", "Food")]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Dining");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Dining")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ name: "Dining" });
  });

  it("shows the 409 message under the name field", async () => {
    mockApi([cat("c1", "Food")]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Add category" }));
    await userEvent.type(screen.getByLabelText("Name"), "food");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const message = await screen.findByText("You already have a category called food");
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(message.textContent!);
  });

  it("limits a category name to the API's 50 characters, with a counter near the limit", async () => {
    mockApi([cat("c1", "Food")]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Add category" }));
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("maxlength", "50");
    expect(screen.queryByText("5/50")).not.toBeInTheDocument();
    await userEvent.type(input, "x".repeat(48));
    expect(screen.getByText("48/50")).toBeInTheDocument();
  });

  it("rejects an over-long existing name with a field error and sends no request", async () => {
    const api = mockApi([cat("c1", "y".repeat(51))]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: /^Edit y+/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Use 50 characters or fewer")).toBeVisible();
    expect(api.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("shows a server 422 on the name field instead of a toast", async () => {
    mockApi([cat("c1", "Food")]);
    server.use(
      http.post("*/api/v1/categories", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Unprocessable Content",
            status: 422,
            detail: "Validation failed",
            request_id: "r",
            errors: [
              {
                loc: ["body", "name"],
                msg: "String should have at most 50 characters",
                type: "string_too_long",
              },
            ],
          },
          { status: 422, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Add category" }));
    await userEvent.type(screen.getByLabelText("Name"), "Coffee");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const message = await screen.findByText("Use 50 characters or fewer");
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(message.textContent!);
    expect(screen.queryByText("Unprocessable Content")).not.toBeInTheDocument();
  });

  it("archives from the edit sheet behind a confirm, with Undo", async () => {
    const api = mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food" }));
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("group", { name: "Confirm archive" })).toHaveTextContent(
      "Nothing is deleted",
    );
    expect(api.calls.filter((c) => c.path.endsWith("/archive"))).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit Food" })).toBeNull());
    expect(await screen.findByText("Archived Food")).toBeInTheDocument();
    // fireEvent: sonner's swipe handling needs setPointerCapture, which jsdom lacks.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Edit Food" })).toBeInTheDocument();
  });

  it("unarchives from the archived list", async () => {
    mockApi([cat("c1", "Food", { archived_at: "2026-09-01T00:00:00Z" })]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("checkbox", { name: /Show archived/ }));
    await userEvent.click(screen.getByRole("button", { name: "Unarchive Food" }));
    expect(await screen.findByRole("button", { name: "Edit Food" })).toBeInTheDocument();
  });

  it("shows no spend text when the spending report fails to load", async () => {
    mockApi([cat("c1", "Food")]);
    server.use(http.get("*/api/v1/reports/spending", () => HttpResponse.error()));
    renderApp("/settings/categories");
    expect(await screen.findByRole("button", { name: "Edit Food" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Nothing yet")).toBeNull());
    expect(screen.queryByText(/this month/)).toBeNull();
  });

  it("shows no spend text while the spending report is loading", async () => {
    mockApi([cat("c1", "Food")]);
    server.use(http.get("*/api/v1/reports/spending", () => new Promise(() => {})));
    renderApp("/settings/categories");
    expect(await screen.findByRole("button", { name: "Edit Food" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing yet")).toBeNull();
  });

  it("keeps a long name fully visible instead of truncating it", async () => {
    const long = "Groceries and household supplies from the corner bazaar";
    mockApi([cat("c1", long)]);
    renderApp("/settings/categories");
    const row = await screen.findByRole("button", { name: `Edit ${long}` });
    expect(within(row).getByText(long)).not.toHaveClass("truncate");
  });

  it("shows this month's spend on expense rows, and Nothing yet otherwise", async () => {
    mockApi(
      [cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })],
      [],
      [{ amount: "3150.00", count: 4, category: { id: "c1" } }],
    );
    renderApp("/settings/categories");
    expect(await screen.findByText("৳3,150 this month")).toBeInTheDocument();
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("makes the whole Show archived row at least 44px tall with a 20px checkbox", async () => {
    mockApi([cat("c1", "Food", { archived_at: "2026-09-01T00:00:00Z" })]);
    renderApp("/settings/categories");
    const checkbox = await screen.findByRole("checkbox", { name: /Show archived/ });
    expect(checkbox).toHaveClass("h-5", "w-5");
    expect(checkbox.closest("label")).toHaveClass("min-h-11");
  });

  it("shows move buttons only in reorder mode, and Done leaves it", async () => {
    mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    renderApp("/settings/categories");
    await screen.findByText("Food");
    expect(screen.queryByRole("button", { name: "Move Bills up" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reorder" }));
    expect(screen.getByRole("button", { name: "Move Bills up" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: "Move Bills up" })).toBeNull();
  });

  it("moves a category up and down, and the order persists", async () => {
    const api = mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    renderApp("/settings/categories");
    await screen.findByText("Food");
    expect(names()).toEqual(["Food", "Bills"]);
    await userEvent.click(screen.getByRole("button", { name: "Reorder" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Bills up" }));
    await waitFor(() => expect(names()).toEqual(["Bills", "Food"]));
    expect(api.cats.map((c) => [c.name, c.sort_order])).toEqual([
      ["Food", 20],
      ["Bills", 10],
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Move Bills down" }));
    await waitFor(() => expect(names()).toEqual(["Food", "Bills"]));
  });

  it("rolls back a failed move", async () => {
    mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    server.use(http.patch("*/api/v1/categories/:id", () => HttpResponse.error()));
    renderApp("/settings/categories");
    await screen.findByText("Food");
    await userEvent.click(screen.getByRole("button", { name: "Reorder" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Bills up" }));
    await waitFor(() => expect(names()).toEqual(["Food", "Bills"]));
  });

  it("refreshes the cache the transaction form reads", async () => {
    mockApi([cat("c1", "Food")]);
    const { client } = renderApp("/settings/categories");
    client.setQueryData(["categories"], [{ id: "stale" }]);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food" }));
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.getQueryState(["categories"])?.isInvalidated).toBe(true));
  });
});

describe("payment methods settings", () => {
  const pm = (id: string, name: string, over: Partial<Pm> = {}): Pm => ({
    id,
    name,
    kind: "cash",
    sort_order: 10,
    archived_at: null,
    ...over,
  });

  it("changes a payment method's kind", async () => {
    const api = mockApi([], [pm("p1", "bKash")]);
    renderApp("/settings/payment-methods");
    await userEvent.click(await screen.findByRole("button", { name: "Edit bKash" }));
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "mobile_wallet");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Mobile wallet")).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      name: "bKash",
      kind: "mobile_wallet",
    });
  });

  it("limits a payment method name to the API's 40 characters", async () => {
    const api = mockApi([], [pm("p1", "z".repeat(41))]);
    renderApp("/settings/payment-methods");
    await userEvent.click(await screen.findByRole("button", { name: /^Edit z+/ }));
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("maxlength", "40");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Use 40 characters or fewer")).toBeVisible();
    expect(api.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("renumbers when neighbours share a sort_order", async () => {
    const api = mockApi([], [pm("p1", "Cash"), pm("p2", "bKash")]);
    renderApp("/settings/payment-methods");
    await screen.findByText("bKash");
    await userEvent.click(screen.getByRole("button", { name: "Reorder" }));
    await userEvent.click(screen.getByRole("button", { name: "Move bKash up" }));
    await waitFor(() => expect(api.pms.find((p) => p.id === "p2")?.sort_order).toBeLessThan(20));
    const order = [...api.pms].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.name);
    expect(order).toEqual(["bKash", "Cash"]);
  });
});
