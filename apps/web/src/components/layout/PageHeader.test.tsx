import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { PageHeader } from "./PageHeader";

function renderHeader(props: React.ComponentProps<typeof PageHeader>) {
  return render(
    <MemoryRouter>
      <PageHeader {...props} />
    </MemoryRouter>,
  );
}

describe("PageHeader", () => {
  it("renders the title as the page's focusable H1", () => {
    renderHeader({ title: "Budgets" });
    expect(screen.getByRole("heading", { level: 1, name: "Budgets" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("renders a labelled back link to the parent page when backTo is set", () => {
    renderHeader({ title: "Tags", backTo: { label: "Settings", to: "/settings" } });
    expect(screen.getByRole("link", { name: "Back to Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("has no back link without backTo", () => {
    renderHeader({ title: "Budgets" });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("titles the tab with the parent page", () => {
    renderHeader({ title: "Tags", backTo: { label: "Settings", to: "/settings" } });
    expect(document.title).toBe("Tags · Settings · Kori");
  });

  it("adds the month to the tab title on month-scoped pages", () => {
    renderHeader({ title: "Transactions", month: "2026-11" });
    expect(document.title).toBe("Transactions · November 2026 · Kori");
  });

  it("renders the actions slot", () => {
    renderHeader({ title: "Recurring", actions: <button type="button">Add rule</button> });
    expect(screen.getByRole("button", { name: "Add rule" })).toBeInTheDocument();
  });
});
