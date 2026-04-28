import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { OfflineCheckinRecord } from "@unihub/shared-types";
import { listOfflineCheckins } from "../offline/db";
import { syncPendingCheckins } from "../offline/sync";

export function CheckinQueuePage() {
  const [records, setRecords] = useState<OfflineCheckinRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setRecords(await listOfflineCheckins());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function retry() {
    const result = await syncPendingCheckins({ includeFailed: true });
    setMessage(`Sync: ${result.synced} synced, ${result.failed} failed`);
    await reload();
  }

  return (
    <section>
      <div className="section-header">
        <h1>Offline queue</h1>
        <button onClick={retry}>
          <RefreshCw size={18} /> Retry
        </button>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Workshop</th>
              <th>Status</th>
              <th>Retry</th>
              <th>Error</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.clientCheckinId}>
                <td>{record.clientCheckinId}</td>
                <td>{record.workshopId}</td>
                <td>{record.syncStatus}</td>
                <td>{record.retryCount}</td>
                <td>{record.lastError ?? ""}</td>
                <td>{new Date(record.updatedAt).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
