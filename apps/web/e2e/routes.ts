// Every screen the accessibility and layout checks visit. Signed-in routes use the seed or CI user.
export const SIGNED_IN_ROUTES = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Transactions", path: "/transactions" },
  { name: "Budgets", path: "/budgets" },
  { name: "Settings", path: "/settings" },
  { name: "Settings, categories", path: "/settings/categories" },
  { name: "Settings, payment methods", path: "/settings/payment-methods" },
  { name: "Settings, tags", path: "/settings/tags" },
  { name: "Not found", path: "/no-such-page" },
] as const;

export const LOGIN_ROUTE = { name: "Log in", path: "/login" } as const;

export const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

// The phone tab bar and the desktop side nav name the same action differently.
export const ADD_BUTTON_NAME = /^Add (transaction|expense)$/;
