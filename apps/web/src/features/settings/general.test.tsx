import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { THEME_STORAGE_KEY } from "@/lib/theme";
import { renderApp } from "@/test/renderApp";
import { server } from "@/test/setup";

const me = {
  id: "u1",
  email: "me@example.com",
  display_name: "Demo",
  timezone: "Asia/Dhaka",
  currency: "BDT",
};

function setWidth(isDesktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width") ? isDesktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  server.use(
    http.get("*/api/v1/auth/me", () => HttpResponse.json(me)),
    http.get("*/api/v1/categories", () => HttpResponse.json([{ id: "c1" }, { id: "c2" }])),
    http.get("*/api/v1/payment-methods", () => HttpResponse.json([{ id: "p1" }])),
    http.get("*/api/v1/tags", () => HttpResponse.json([])),
  );
});

describe("settings on a phone", () => {
  beforeEach(() => setWidth(false));

  it("lists the sections with their counts", async () => {
    renderApp("/settings");
    const categories = await screen.findByRole("link", { name: /Categories/ });
    expect(await within(categories).findByText("2")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /Payment methods/ })).getByText("1"),
    ).toBeVisible();
    expect(within(screen.getByRole("link", { name: /Tags/ })).getByText("0")).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Settings sections" })).not.toBeInTheDocument();
  });

  it("shows the profile and a destructive Log out", async () => {
    renderApp("/settings");
    expect(await screen.findByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText("Asia/Dhaka, Taka (৳, BDT)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe("settings on desktop", () => {
  beforeEach(() => setWidth(true));

  it("shows General with the sub-menu and marks the active item", async () => {
    renderApp("/settings");
    const menu = await screen.findByRole("navigation", { name: "Settings sections" });
    expect(within(menu).getByRole("link", { name: "General" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(menu).getByRole("link", { name: "Categories" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(await screen.findByText("Taka (৳, BDT)")).toBeInTheDocument();
  });

  it("keeps the sub-menu on a subpage and moves the active item", async () => {
    renderApp("/settings/tags");
    const menu = await screen.findByRole("navigation", { name: "Settings sections" });
    expect(within(menu).getByRole("link", { name: "Tags" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(menu).getByRole("link", { name: "General" })).not.toHaveAttribute("aria-current");
  });
});

describe("theme switch", () => {
  beforeEach(() => setWidth(false));

  it("starts on System", async () => {
    renderApp("/settings");
    expect(await screen.findByRole("radio", { name: "System" })).toBeChecked();
  });

  it("applies and remembers Dark", async () => {
    renderApp("/settings");
    await userEvent.click(await screen.findByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("returns to light when Light is chosen after Dark", async () => {
    renderApp("/settings");
    await userEvent.click(await screen.findByRole("radio", { name: "Dark" }));
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("shows the saved choice after a reload", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderApp("/settings");
    expect(await screen.findByRole("radio", { name: "Dark" })).toBeChecked();
  });
});
