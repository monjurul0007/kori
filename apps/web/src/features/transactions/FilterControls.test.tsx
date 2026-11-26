import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";

import { InlineFilters, TypeChips } from "./FilterControls";
import type { Filters } from "./filters";
import { bills, food } from "./fixtures";

const base: Filters = { month: "2026-09", categoryIds: [], q: "" };
const salary = { id: "c-salary", name: "Salary", kind: "income" as const };

function renderInline(filters: Filters = base) {
  server.use(
    http.get("*/api/v1/categories", () => HttpResponse.json([food, bills, salary])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([{ id: "pm1", name: "bKash" }])),
    http.get("*/api/v1/tags", () => HttpResponse.json([{ id: "t1", name: "eid", usage_count: 2 }])),
  );
  const onChange = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <InlineFilters filters={filters} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("InlineFilters", () => {
  it("filters by one category chosen from the grouped dropdown", async () => {
    const onChange = renderInline();
    await screen.findByRole("option", { name: "Salary" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Salary");
    expect(onChange).toHaveBeenCalledWith({ categoryIds: ["c-salary"] });
  });

  it("puts income categories in their own group", async () => {
    renderInline();
    const income = await screen.findByRole("group", { name: "Income" });
    expect(income).toContainElement(screen.getByRole("option", { name: "Salary" }));
    expect(income).not.toContainElement(screen.getByRole("option", { name: food.name }));
  });

  it("names the selection when several categories are filtered", async () => {
    renderInline({ ...base, categoryIds: [food.id, bills.id] });
    expect(await screen.findByRole("option", { name: "2 categories" })).toBeInTheDocument();
  });

  it("clears the category back to all", async () => {
    const onChange = renderInline({ ...base, categoryIds: [food.id] });
    await screen.findByRole("option", { name: "Salary" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Category");
    expect(onChange).toHaveBeenCalledWith({ categoryIds: [] });
  });

  it("filters by type, payment method and tag", async () => {
    const onChange = renderInline();
    await screen.findByRole("option", { name: "bKash" });
    await screen.findByRole("option", { name: "eid" });
    await userEvent.selectOptions(screen.getByLabelText("Type"), "Income");
    expect(onChange).toHaveBeenLastCalledWith({ type: "income" });
    await userEvent.selectOptions(screen.getByLabelText("Paid with"), "bKash");
    expect(onChange).toHaveBeenLastCalledWith({ paymentMethodId: "pm1" });
    await userEvent.selectOptions(screen.getByLabelText("Tag"), "eid");
    expect(onChange).toHaveBeenLastCalledWith({ tag: "eid" });
  });
});

describe("TypeChips", () => {
  it("marks the active type and changes it on tap", async () => {
    const onChange = vi.fn();
    render(<TypeChips filters={{ ...base, type: "expense" }} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Expenses" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(onChange).toHaveBeenCalledWith({ type: "income" });
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenLastCalledWith({ type: undefined });
  });
});
