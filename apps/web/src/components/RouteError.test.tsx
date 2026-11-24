import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { RouteError } from "./RouteError";

describe("RouteError", () => {
  it("shows the error when a route throws while rendering", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("kaboom");
    }
    const router = createMemoryRouter([
      { path: "/", element: <Boom />, errorElement: <RouteError /> },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("alert")).toHaveTextContent("kaboom");
  });

  it("offers both Reload and Go to dashboard", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("kaboom");
    }
    const router = createMemoryRouter([
      { path: "/", element: <Boom />, errorElement: <RouteError /> },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
