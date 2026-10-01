import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    const hidden = Boolean(0);
    expect(cn("a", hidden && "b", undefined, "c")).toBe("a c");
  });

  it("lets the later Tailwind class win", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
