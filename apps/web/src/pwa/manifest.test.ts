import { manifest, NEW_EXPENSE_PARAM, NEW_EXPENSE_VALUE } from "./manifest";

describe("web app manifest", () => {
  it("has a stable id and finance categories", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.categories).toEqual(["finance", "productivity"]);
  });

  it("offers an Add expense shortcut that deep-links to the new-expense sheet", () => {
    const add = manifest.shortcuts?.find((s) => s.name === "Add expense");
    expect(add?.url).toBe(`/transactions?${NEW_EXPENSE_PARAM}=${NEW_EXPENSE_VALUE}`);
    expect(add?.icons?.[0]?.sizes).toBe("96x96");
  });

  it("offers a This month shortcut", () => {
    expect(manifest.shortcuts?.find((s) => s.name === "This month")?.url).toBe("/transactions");
  });
});
