import { Link } from "react-router-dom";

export function AdminDashboardPage() {
  return (
    <section>
      <h1>Admin</h1>
      <div className="grid compact">
        <Link className="panel nav-panel" to="/admin/workshops">
          Workshop CRUD
        </Link>
        <Link className="panel nav-panel" to="/admin/statistics">
          Statistics
        </Link>
        <Link className="panel nav-panel" to="/admin/ai-summary">
          AI Summary
        </Link>
      </div>
    </section>
  );
}
