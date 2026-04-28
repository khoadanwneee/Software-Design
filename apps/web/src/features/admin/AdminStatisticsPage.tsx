import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function AdminStatisticsPage() {
  const stats = useQuery({ queryKey: ["admin-statistics"], queryFn: () => api.adminApi.statistics() });

  return (
    <section>
      <h1>Statistics</h1>
      {stats.error ? <p className="error">{stats.error.message}</p> : null}
      {stats.data ? (
        <div className="grid compact">
          <div className="panel metric">
            <span>{stats.data.workshops}</span>
            <p>Workshops</p>
          </div>
          <div className="panel metric">
            <span>{stats.data.registrations}</span>
            <p>Registrations</p>
          </div>
          <div className="panel metric">
            <span>{stats.data.checkins}</span>
            <p>Check-ins</p>
          </div>
          <div className="panel metric">
            <span>{stats.data.revenue.toLocaleString("vi-VN")}</span>
            <p>Revenue</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
