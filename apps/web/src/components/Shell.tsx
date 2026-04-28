import { Link, NavLink, Outlet } from "react-router-dom";
import { ClipboardList, LogOut, QrCode, Settings, Wifi, WifiOff } from "lucide-react";
import { Role } from "@unihub/shared-types";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useAuth } from "../features/auth/AuthProvider";

export function Shell() {
  const online = useOnlineStatus();
  const { user, logout } = useAuth();
  const canAdmin = user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role));
  const canCheckin = user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER, Role.CHECKIN_STAFF].includes(role));

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
          {canCheckin ? (
            <NavLink to="/checkin">
              <QrCode size={18} /> Check-in
            </NavLink>
          ) : null}
          {canAdmin ? (
            <NavLink to="/admin">
              <Settings size={18} /> Admin
            </NavLink>
          ) : null}
        </nav>
        <div className="session">
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
