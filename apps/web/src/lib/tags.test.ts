import { normalizeTagName, suggestTags, withTag } from "./tags";

describe("normalizeTagName", () => {
  it("lowercases, trims, strips a leading # and joins words with a dash", () => {
    expect(normalizeTagName("  #QA Mixed   Case ")).toBe("qa-mixed-case");
  });
});

describe("withTag", () => {
  it("adds the normalised tag", () => {
    expect(withTag([], "QA Mixed Case")).toEqual(["qa-mixed-case"]);
  });

  it("ignores blanks and tags that match an existing one after normalising", () => {
    const tags = ["qa-mixed-case"];
    expect(withTag(tags, "   ")).toBe(tags);
    expect(withTag(tags, "#QA mixed case")).toBe(tags);
  });
});

describe("suggestTags", () => {
  const known = ["lunch", "eid", "eidgah", "pre-eid"];

  it("lists prefix matches before other matches", () => {
    expect(suggestTags(known, [], "ei")).toEqual(["eid", "eidgah", "pre-eid"]);
  });

  it("skips chosen tags and returns nothing for blank text", () => {
    expect(suggestTags(known, ["eid"], "ei")).toEqual(["eidgah", "pre-eid"]);
    expect(suggestTags(known, [], "  ")).toEqual([]);
  });

  it("returns at most eight matches", () => {
    const many = Array.from({ length: 12 }, (_, i) => `trip-${i}`);
    expect(suggestTags(many, [], "trip")).toHaveLength(8);
  });
});
