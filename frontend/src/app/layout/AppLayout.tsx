import { Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import Header from "../../components/Header";

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div>
      <Header user={user} onLogout={logout} />
      <Outlet />
    </div>
  );
}
