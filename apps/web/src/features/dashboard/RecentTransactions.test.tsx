import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeTx } from "../transactions/fixtures";
import { RecentTransactions } from "./RecentTransactions";
import { mockGet, renderCard } from "./testHelpers";

const page = (ids: string[]) => ({
  items: ids.map((id) => makeTx(id)),
  next_cursor: null,
  totals: { expense: "0", income: "0", count: ids.length },
});

describe("RecentTransactions", () => {
  it("shows only the 5 newest and links to the month's list", async () => {
    mockGet("/api/v1/transactions", page(["a", "b", "c", "d", "e", "f", "g"]));
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByText("Shop e")).toBeInTheDocument();
    expect(screen.queryByText("Shop f")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09",
    );
  });

  it("says so when the month is empty", async () => {
    mockGet("/api/v1/transactions", page([]));
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByText("No transactions this month.")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    mockGet("/api/v1/transactions", { title: "x", status: 500 }, 500);
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load recent transactions.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("opens the edit sheet when a row is selected", async () => {
    mockGet("/api/v1/transactions", page(["a"]));
    mockGet("/api/v1/categories", []);
    mockGet("/api/v1/payment-methods", []);
    mockGet("/api/v1/tags", []);
    renderCard(<RecentTransactions month="2026-09" />);
    await userEvent.click(await screen.findByRole("button", { name: /Shop a/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
