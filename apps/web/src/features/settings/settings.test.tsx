import { screen, waitFor, within } from "@testing-library/react";
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
function mockApi(initialCats: Cat[], initialPms: Pm[] = []) {
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
    .map((li) => li.querySelector("span")?.textContent)
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
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You already have a category called food");
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(alert.textContent!);
  });

  it("archives behind a confirm, then unarchives from the archived list", async () => {
    mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    renderApp("/settings/categories");
    await userEvent.click(await screen.findByRole("button", { name: "Archive Food" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Nothing is deleted");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit Food" })).toBeNull());
    await userEvent.click(screen.getByRole("checkbox", { name: /Show archived/ }));
    await userEvent.click(screen.getByRole("button", { name: "Unarchive Food" }));
    expect(await screen.findByRole("button", { name: "Edit Food" })).toBeInTheDocument();
  });

  it("moves a category up and down, and the order persists", async () => {
    const api = mockApi([cat("c1", "Food"), cat("c2", "Bills", { sort_order: 20 })]);
    renderApp("/settings/categories");
    await screen.findByText("Food");
    expect(names()).toEqual(["Food", "Bills"]);
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
    await userEvent.click(screen.getByRole("button", { name: "Move Bills up" }));
    await waitFor(() => expect(names()).toEqual(["Food", "Bills"]));
  });

  it("refreshes the cache the transaction form reads", async () => {
    mockApi([cat("c1", "Food")]);
    const { client } = renderApp("/settings/categories");
    client.setQueryData(["categories"], [{ id: "stale" }]);
    await userEvent.click(await screen.findByRole("button", { name: "Archive Food" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Archive" }),
    );
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

  it("renumbers when neighbours share a sort_order", async () => {
    const api = mockApi([], [pm("p1", "Cash"), pm("p2", "bKash")]);
    renderApp("/settings/payment-methods");
    await screen.findByText("bKash");
    await userEvent.click(screen.getByRole("button", { name: "Move bKash up" }));
    await waitFor(() => expect(api.pms.find((p) => p.id === "p2")?.sort_order).toBeLessThan(20));
    const order = [...api.pms].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.name);
    expect(order).toEqual(["bKash", "Cash"]);
  });
});
