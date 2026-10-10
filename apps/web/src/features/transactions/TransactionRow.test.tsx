import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { bills, food, makeTx } from "./fixtures";
import { TransactionRow } from "./TransactionRow";

const renderRow = (tx = makeTx("a"), onSelect = vi.fn()) => {
  render(
    <ul>
      <TransactionRow transaction={tx} onSelect={onSelect} />
    </ul>,
  );
  return onSelect;
};

describe("TransactionRow", () => {
  it("prefers merchant, then note, then the category name", () => {
    const { unmount } = render(
      <ul>
        <TransactionRow transaction={makeTx("a")} onSelect={() => {}} />
      </ul>,
    );
    expect(screen.getByText("Shop a")).toBeInTheDocument();
    unmount();

    const { unmount: unmountNote } = render(
      <ul>
        <TransactionRow
          transaction={makeTx("a", { merchant: null, note: "dupur er khabar" })}
          onSelect={() => {}}
        />
      </ul>,
    );
    expect(screen.getByText("dupur er khabar")).toBeInTheDocument();
    unmountNote();

    render(
      <ul>
        <TransactionRow transaction={makeTx("a", { merchant: null })} onSelect={() => {}} />
      </ul>,
    );
    expect(screen.getAllByText("Food & Dining")).toHaveLength(2); // title and chip
  });

  it("shows the category chip and payment method", () => {
    renderRow();
    expect(screen.getByText("Food & Dining")).toBeInTheDocument();
    expect(screen.getByText("bKash")).toBeInTheDocument();
  });

  it("labels a split with its line count", () => {
    renderRow(
      makeTx("s", {
        is_split: true,
        lines: [
          { category: food, amount: "100", category_source: "user" },
          { category: bills, amount: "150", category_source: "user" },
        ],
      }),
    );
    expect(screen.getByText("Split · 2 categories")).toBeInTheDocument();
  });

  it("shows up to two tags and a +N for the rest", () => {
    renderRow(makeTx("t", { tags: ["eid", "trip", "family", "gift"] }));
    expect(screen.getByText("#eid")).toBeInTheDocument();
    expect(screen.getByText("#trip")).toBeInTheDocument();
    expect(screen.queryByText("#family")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("omits +N when there are two tags or fewer", () => {
    renderRow(makeTx("t", { tags: ["eid", "trip"] }));
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it("shows income in green with a plus and expenses plain", () => {
    renderRow(makeTx("i", { type: "income", amount: "120000" }));
    expect(screen.getByText("+৳1,20,000")).toHaveClass("text-emerald-600");
  });

  it("formats expense amounts without a sign", () => {
    renderRow(makeTx("e", { amount: "1250.50" }));
    const amount = screen.getByText("৳1,250.50");
    expect(amount).not.toHaveClass("text-emerald-600");
  });

  it("reports the transaction when tapped", async () => {
    const tx = makeTx("a");
    const onSelect = renderRow(tx);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(tx);
  });
});
