import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, LogOut, Settings, Wifi, WifiOff } from "lucide-react";
import { Role } from "@unihub/shared-types";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { api } from "../lib/api";
import { useAuth } from "../features/auth/AuthProvider";

export function Shell() {
  const online = useOnlineStatus();
  const { user, logout } = useAuth();
  const canAdmin = user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role));
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.notificationApi.unreadCount(),
    refetchInterval: 3000,
    enabled: Boolean(user)
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/workshops" className="brand">
          UniHub Workshop
        </Link>
        <nav aria-label="Primary">
          <NavLink to="/workshops">
            <ClipboardList size={18} /> Workshops
          </NavLink>
          {canAdmin ? (
            <NavLink to="/admin">
              <Settings size={18} /> Admin
            </NavLink>
          ) : null}
        </nav>
        <div className="session">
          <Link
            to="/notifications"
            className="icon-button icon-link nav-bell"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={18} />
            {unread.data && unread.data.count > 0 ? (
              <span className="icon-badge" aria-hidden="true">
                {unread.data.count}
              </span>
            ) : null}
          </Link>
          <span className={online ? "status online" : "status offline"}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            {online ? "Online" : "Offline"}
          </span>
          <span>{user?.fullName}</span>
          <button className="icon-button" onClick={logout} aria-label="Logout" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
