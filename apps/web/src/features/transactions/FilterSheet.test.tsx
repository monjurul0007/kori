import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";

import { FilterSheet } from "./FilterSheet";
import type { Filters } from "./filters";
import { bills, food } from "./fixtures";

const base: Filters = { month: "2026-09", categoryIds: [], q: "" };

async function open(filters: Filters = base, categories: unknown[] = [food, bills]) {
  server.use(
    http.get("*/api/v1/categories", () => HttpResponse.json(categories)),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([{ id: "pm1", name: "bKash" }])),
    http.get("*/api/v1/tags", () => HttpResponse.json([{ id: "t1", name: "eid", usage_count: 2 }])),
  );
  const onChange = vi.fn();
  const onClearAll = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FilterSheet filters={filters} onChange={onChange} onClearAll={onClearAll} />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("button", { name: (categories[0] as typeof food).name }); // reference data loaded
  return { dialog, onChange, onClearAll };
}

describe("FilterSheet", () => {
  it("changes the type", async () => {
    const { dialog, onChange } = await open();
    await userEvent.selectOptions(within(dialog).getByLabelText("Type"), "expense");
    expect(onChange).toHaveBeenCalledWith({ type: "expense" });
  });

  it("clears the type back to all", async () => {
    const { dialog, onChange } = await open({ ...base, type: "income" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Type"), "All");
    expect(onChange).toHaveBeenCalledWith({ type: undefined });
  });

  it("adds a category to those already selected", async () => {
    const { dialog, onChange } = await open({ ...base, categoryIds: [food.id] });
    await userEvent.click(within(dialog).getByRole("button", { name: "Bills" }));
    expect(onChange).toHaveBeenCalledWith({ categoryIds: [food.id, bills.id] });
  });

  it("removes a selected category on a second tap", async () => {
    const { dialog, onChange } = await open({ ...base, categoryIds: [food.id, bills.id] });
    const chip = within(dialog).getByRole("button", { name: "Bills" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith({ categoryIds: [food.id] });
  });

  it("filters by payment method and tag", async () => {
    const { dialog, onChange } = await open();
    await userEvent.selectOptions(within(dialog).getByLabelText("Payment method"), "bKash");
    expect(onChange).toHaveBeenLastCalledWith({ paymentMethodId: "pm1" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Tag"), "eid");
    expect(onChange).toHaveBeenLastCalledWith({ tag: "eid" });
  });

  it("clears every filter from the footer", async () => {
    const { dialog, onClearAll } = await open({ ...base, type: "income" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("groups categories under Expense and Income", async () => {
    const salary = { id: "c-salary", name: "Salary", kind: "income" as const };
    const { dialog } = await open(base, [food, salary]);
    const expense = within(dialog).getByRole("group", { name: "Expense categories" });
    const income = within(dialog).getByRole("group", { name: "Income categories" });
    expect(within(expense).getByRole("button", { name: food.name })).toBeInTheDocument();
    expect(within(income).getByRole("button", { name: "Salary" })).toBeInTheDocument();
  });
});
