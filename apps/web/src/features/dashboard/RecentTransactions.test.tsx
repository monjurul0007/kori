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
  it("shows only the 6 newest and links to the month's list", async () => {
    mockGet("/api/v1/transactions", page(["a", "b", "c", "d", "e", "f", "g"]));
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByText("Shop f")).toBeInTheDocument();
    expect(screen.queryByText("Shop g")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all transactions" })).toHaveAttribute(
      "href",
      "/transactions?month=2026-09",
    );
  });

  it("groups rows by day, each with that day's spending", async () => {
    mockGet("/api/v1/transactions", {
      items: [
        makeTx("a", { occurred_on: "2026-09-10", amount: "320" }),
        makeTx("b", { occurred_on: "2026-09-10", amount: "850.50" }),
        makeTx("c", { occurred_on: "2026-09-09", amount: "70" }),
      ],
      next_cursor: null,
      totals: { expense: "0", income: "0", count: 3 },
    });
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByText("Thu, 10 Sep")).toBeInTheDocument();
    expect(screen.getByText("Wed, 9 Sep")).toBeInTheDocument();
    expect(screen.getByText("৳1,170.50")).toBeInTheDocument();
  });

  it("totals every expense of a day, not only the rows shown", async () => {
    mockGet("/api/v1/transactions", {
      items: Array.from({ length: 8 }, (_, i) =>
        makeTx(`t${i}`, { occurred_on: "2026-09-10", amount: "100" }),
      ),
      next_cursor: null,
      totals: { expense: "0", income: "0", count: 8 },
    });
    renderCard(<RecentTransactions month="2026-09" />);
    expect(await screen.findByText("Shop t5")).toBeInTheDocument();
    expect(screen.queryByText("Shop t6")).not.toBeInTheDocument();
    expect(screen.getByText("৳800")).toBeInTheDocument();
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
