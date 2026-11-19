import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { RouteError } from "@/components/RouteError";
import { AppShell } from "@/components/layout/AppShell";
import { BudgetsPage } from "@/features/budgets/BudgetsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { CategoriesSettingsPage } from "@/features/settings/CategoriesSettingsPage";
import { PaymentMethodsSettingsPage } from "@/features/settings/PaymentMethodsSettingsPage";
import { TagsSettingsPage } from "@/features/settings/TagsSettingsPage";
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
              { path: "/", element: <Navigate to="/dashboard" replace /> },
              { path: "/dashboard", element: <DashboardPage /> },
              { path: "/transactions", element: <TransactionsPage /> },
              { path: "/budgets", element: <BudgetsPage /> },
              { path: "/settings", element: <SettingsPage /> },
              { path: "/settings/categories", element: <CategoriesSettingsPage /> },
              { path: "/settings/payment-methods", element: <PaymentMethodsSettingsPage /> },
              { path: "/settings/tags", element: <TagsSettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
