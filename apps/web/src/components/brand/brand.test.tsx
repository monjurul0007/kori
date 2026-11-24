import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";

import { KoriMark } from "./KoriMark";
import { Wordmark } from "./Wordmark";

describe("Wordmark", () => {
  it("exposes the accessible name Kori and marks the Bangla text lang=bn", () => {
    const { container } = render(<Wordmark />);
    expect(screen.getByText("Kori")).toBeInTheDocument();
    expect(container).toHaveTextContent(/^Kori\s*কড়ি$/);
    const bn = screen.getByText("কড়ি");
    expect(bn).toHaveAttribute("lang", "bn");
  });

  it("can hide the Bangla name", () => {
    render(<Wordmark showBangla={false} />);
    expect(screen.queryByText("কড়ি")).not.toBeInTheDocument();
  });
});

describe("KoriMark", () => {
  it("is decorative and drawn without text", () => {
    const { container } = render(<KoriMark size={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "40");
    expect(svg.querySelector("text")).toBeNull();
  });
});

describe("favicon", () => {
  it("public/icon.svg is drawn from shapes only (no font-dependent text)", () => {
    const svg = readFileSync(path.resolve(import.meta.dirname, "../../../public/icon.svg"), "utf8");
    expect(svg).not.toMatch(/<text[\s>]/);
    expect(svg).toContain("#2F3A99");
  });
});
