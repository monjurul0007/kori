import type { ManifestOptions } from "vite-plugin-pwa";

const THEME_COLOR = "#2F3A99"; // --brand in docs/design/tokens.css

/** Where the "Add expense" shortcut lands; TransactionsPage opens the sheet for this value. */
export const NEW_EXPENSE_PARAM = "new";
export const NEW_EXPENSE_VALUE = "expense";

export const manifest: Partial<ManifestOptions> = {
  id: "/",
  name: "Kori",
  short_name: "Kori",
  description: "Personal expense and budget tracker",
  categories: ["finance", "productivity"],
  theme_color: THEME_COLOR,
  background_color: THEME_COLOR,
  display: "standalone",
  start_url: "/dashboard",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Add expense",
      url: `/transactions?${NEW_EXPENSE_PARAM}=${NEW_EXPENSE_VALUE}`,
      icons: [{ src: "shortcut-add-96.png", sizes: "96x96", type: "image/png" }],
    },
    { name: "This month", url: "/transactions" },
  ],
};
