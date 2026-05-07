import { Link } from "react-router-dom";
import { Role } from "@unihub/shared-types";
import { useAuth } from "../auth/AuthProvider";

export function AdminDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes(Role.ADMIN);

  return (
    <section>
      <h1>Admin</h1>
      <div className="grid compact">
        <Link className="panel nav-panel" to="/admin/workshops">
          Workshop CRUD
        </Link>
        <Link className="panel nav-panel" to="/admin/rooms">
          Rooms
        </Link>
        <Link className="panel nav-panel" to="/admin/statistics">
          Statistics
        </Link>
        <Link className="panel nav-panel" to="/admin/ai-summary">
          AI Summary
        </Link>
        {isAdmin ? (
          <Link className="panel nav-panel" to="/admin/users">
            Users & roles
          </Link>
        ) : null}
        {isAdmin ? (
          <Link className="panel nav-panel" to="/admin/student-imports">
            Student imports
          </Link>
        ) : null}
      </div>
    </section>
  );
}
