import { createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "./layout/AuthLayout";
import { AppLayout } from "./layout/AppLayout";
import { RequireAuth } from "./guards/RequireAuth";
import { RequireRole } from "./guards/RequireRole";

import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { HomePage } from "../pages/HomePage";
import { CatalogPage } from "../pages/CatalogPage";
import ScenarioPage from "../pages/ScenarioPage";
import { CabinetPage } from "../pages/CabinetPage";
import { WikiPage } from "../pages/WikiPage";
import { ModerationPage } from "../pages/ModerationPage";
import { UsersPage } from "../pages/UsersPage";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },

  // Главная доступна без входа: это «витрина» сервиса
  {
    element: <AppLayout />,
    children: [{ path: "/", element: <HomePage /> }],
  },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/catalog", element: <CatalogPage /> },
          { path: "/wiki", element: <WikiPage /> },
          { path: "/cabinet", element: <CabinetPage /> },
          { path: "/scenario", element: <ScenarioPage /> },
          { path: "/scenario/:id", element: <ScenarioPage /> },

          {
            element: <RequireRole roles={["moderator", "admin"]} />,
            children: [{ path: "/moderation", element: <ModerationPage /> }],
          },
          {
            element: <RequireRole roles={["admin"]} />,
            children: [{ path: "/users", element: <UsersPage /> }],
          },
        ],
      },
    ],
  },
]);
