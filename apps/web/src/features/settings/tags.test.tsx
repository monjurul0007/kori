import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const me = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

type Tag = { id: string; name: string; usage_count: number };

function mockTags(initial: Tag[]) {
  const tags = [...initial];
  const calls: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(me)),
    http.get("*/api/v1/tags", () => HttpResponse.json(tags)),
    http.patch("*/api/v1/tags/:id", async ({ request, params }) => {
      const body = (await request.json()) as { name: string };
      calls.push({ method: "PATCH", path: `/tags/${params.id}`, body });
      const tag = tags.find((t) => t.id === params.id)!;
      const target = tags.find((t) => t.name === body.name && t.id !== tag.id);
      if (target) {
        target.usage_count += tag.usage_count;
        tags.splice(tags.indexOf(tag), 1);
        return HttpResponse.json(target);
      }
      tag.name = body.name;
      return HttpResponse.json(tag);
    }),
    http.delete("*/api/v1/tags/:id", ({ params }) => {
      calls.push({ method: "DELETE", path: `/tags/${params.id}`, body: undefined });
      tags.splice(
        tags.findIndex((t) => t.id === params.id),
        1,
      );
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { tags, calls };
}

const sample = () => [
  { id: "t1", name: "work", usage_count: 2 },
  { id: "t2", name: "lunch", usage_count: 12 },
  { id: "t3", name: "food", usage_count: 12 },
];

describe("tags settings", () => {
  it("links to the page from Settings", async () => {
    mockTags([]);
    renderApp("/settings");
    expect(await screen.findByRole("link", { name: /Tags/ })).toHaveAttribute(
      "href",
      "/settings/tags",
    );
  });

  it("lists tags by usage, then name, with counts and a naming hint", async () => {
    mockTags(sample());
    renderApp("/settings/tags");
    await screen.findByText("#food");
    const rows = screen.getAllByRole("button", { name: /^Edit #/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      "#food12 transactions",
      "#lunch12 transactions",
      "#work2 transactions",
    ]);
    expect(screen.getByText("Tags are saved in lowercase; spaces become hyphens.")).toBeVisible();
  });

  it("filters tags by the search box", async () => {
    mockTags(sample());
    renderApp("/settings/tags");
    await userEvent.type(await screen.findByRole("searchbox", { name: "Find a tag" }), "Lu");
    expect(screen.getByRole("button", { name: "Edit #lunch" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit #food" })).toBeNull();
    await userEvent.type(screen.getByRole("searchbox", { name: "Find a tag" }), "zzz");
    expect(screen.getByText(/No tags match/)).toBeVisible();
  });

  it("shows an empty state", async () => {
    mockTags([]);
    renderApp("/settings/tags");
    expect(await screen.findByText("Tags you add to transactions appear here.")).toBeVisible();
  });

  it("previews how a name will be saved, and renames to it", async () => {
    const api = mockTags(sample());
    renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #work" }));
    const input = screen.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "  Day Job ");
    expect(screen.getByText("Saved as #day-job")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("#day-job")).toBeInTheDocument());
    expect(api.calls).toEqual([{ method: "PATCH", path: "/tags/t1", body: { name: "day-job" } }]);
  });

  it("warns about a merge in the sheet, and only merges when asked", async () => {
    const api = mockTags(sample());
    renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #lunch" }));
    const input = screen.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "Food");
    expect(screen.getByRole("status")).toHaveTextContent(
      "#food already exists. Merge #lunch into #food? 12 transactions will use #food.",
    );
    expect(api.calls).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(screen.queryByText("#lunch")).not.toBeInTheDocument());
    expect(api.calls).toEqual([{ method: "PATCH", path: "/tags/t2", body: { name: "food" } }]);
    expect(await screen.findByText("24 transactions")).toBeInTheDocument();
  });

  it("shows a server 422 under the field", async () => {
    mockTags(sample());
    server.use(
      http.patch("*/api/v1/tags/:id", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Invalid",
            status: 422,
            detail: "Too long",
            request_id: "r",
          },
          { status: 422, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #work" }));
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Too long")).toBeVisible();
  });

  it("deletes from the sheet after confirming the usage count", async () => {
    const api = mockTags(sample());
    renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #lunch" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    expect(screen.getByText(/removed from 12 transactions/)).toBeVisible();
    expect(api.calls).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("#lunch")).not.toBeInTheDocument());
    expect(api.calls).toEqual([{ method: "DELETE", path: "/tags/t2", body: undefined }]);
  });

  it("keeps the tag when the delete confirm is cancelled", async () => {
    const api = mockTags(sample());
    renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #lunch" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/removed from/)).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("opens the filtered transactions list from the sheet", async () => {
    mockTags(sample());
    const { router } = renderApp("/settings/tags");
    await userEvent.click(await screen.findByRole("button", { name: "Edit #lunch" }));
    await userEvent.click(screen.getByRole("link", { name: /View transactions tagged #lunch/ }));
    expect(router.state.location.pathname).toBe("/transactions");
    expect(router.state.location.search).toBe("?tag=lunch");
  });
});
