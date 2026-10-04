import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { RouteError } from "@/components/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";

export const routes: RouteObject[] = [
  {
    // Render errors anywhere below fall back to <RouteError />; React Router owns the boundary.
    errorElement: <RouteError />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/", element: <Navigate to="/transactions" replace /> },
              { path: "/transactions", element: <TransactionsPage /> },
              { path: "/settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
