import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, RefreshCw } from "lucide-react";
import { StudentImportStatus } from "@unihub/shared-types";
import { api } from "../../lib/api";

const statuses = Object.values(StudentImportStatus);

export function AdminStudentImportsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StudentImportStatus | "ALL">("ALL");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: status === "ALL" ? undefined : status,
      limit: 20
    }),
    [status]
  );
  const imports = useQuery({
    queryKey: ["student-imports", filters],
    queryFn: () => api.studentImportApi.list(filters),
    refetchInterval: 10_000
  });
  const detail = useQuery({
    queryKey: ["student-import", selectedRunId],
    queryFn: () => api.studentImportApi.detail(selectedRunId!),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) =>
      query.state.data?.status === StudentImportStatus.PENDING || query.state.data?.status === StudentImportStatus.RUNNING
        ? 5_000
        : false
  });
  const upload = useMutation({
    mutationFn: (body: FormData) => api.studentImportApi.upload(body),
    onSuccess: async (response) => {
      setMessage(response.message);
      setSelectedRunId(response.jobId);
      await queryClient.invalidateQueries({ queryKey: ["student-imports"] });
    }
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a CSV file before uploading.");
      return;
    }
    upload.mutate(formData);
  }

  return (
    <section>
      <div className="section-header">
        <h1>Student imports</h1>
        <button className="secondary" onClick={() => void imports.refetch()}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={submit}>
          <label>
            CSV file
            <input name="file" type="file" accept=".csv,text/csv" />
          </label>
          <label>
            Import type
            <input name="importType" defaultValue="STUDENT_NIGHTLY" />
          </label>
          <label className="full">
            Description
            <input name="description" placeholder="Nightly CSV exported from legacy student system" />
          </label>
          <label className="checkbox-row full">
            <input name="dryRun" type="checkbox" value="true" />
            Dry run
          </label>
          <button className="full" disabled={upload.isPending} type="submit">
            <FileUp size={18} /> Upload CSV
          </button>
        </form>
        {message ? <p className="notice">{message}</p> : null}
        {upload.error ? <p className="error">{upload.error.message}</p> : null}
      </div>

      <div className="toolbar">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as StudentImportStatus | "ALL")}>
            <option value="ALL">All</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {imports.error ? <p className="error">{imports.error.message}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Total</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {imports.data?.items.map((run) => (
              <tr key={run.id}>
                <td>{run.fileName}</td>
                <td>{run.status}</td>
                <td>{run.totalRows}</td>
                <td>{run.successRows}</td>
                <td>{run.failedRows}</td>
                <td>{new Date(run.createdAt).toLocaleString("vi-VN")}</td>
                <td>
                  <button className="secondary" onClick={() => setSelectedRunId(run.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail.data ? (
        <div className="panel">
          <h2>{detail.data.fileName}</h2>
          <div className="grid compact">
            <div className="metric">
              <span>{detail.data.totalRows}</span>
              <p>Total rows</p>
            </div>
            <div className="metric">
              <span>{detail.data.successRows}</span>
              <p>Success</p>
            </div>
            <div className="metric">
              <span>{detail.data.failedRows}</span>
              <p>Failed</p>
            </div>
          </div>
          {detail.data.errorMessage ? <p className="error">{detail.data.errorMessage}</p> : null}
          <h3>Row errors</h3>
          {detail.data.errors.length === 0 ? <p className="notice">No row errors.</p> : null}
          {detail.data.errors.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Student code</th>
                    <th>Email</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.errors.map((error) => (
                    <tr key={error.id}>
                      <td>{error.rowNumber}</td>
                      <td>{error.studentCode ?? ""}</td>
                      <td>{error.email ?? ""}</td>
                      <td>
                        {error.errorCode}: {error.errorMessage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
