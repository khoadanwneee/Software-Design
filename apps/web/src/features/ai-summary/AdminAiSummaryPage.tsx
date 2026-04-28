import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { api } from "../../lib/api";

export function AdminAiSummaryPage() {
  const [workshopId, setWorkshopId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const workshops = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;
    if (!file || !workshopId) {
      return;
    }

    const result = await api.aiSummaryApi.uploadMetadata({
      workshopId,
      fileName: file.name,
      contentType: file.type || "application/pdf",
      size: file.size
    });
    setMessage(`AI job ${result.status}: ${result.aiDocumentId}`);
  }

  return (
    <section className="panel">
      <h1>AI Summary</h1>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Workshop
          <select value={workshopId} onChange={(event) => setWorkshopId(event.target.value)}>
            <option value="">Select workshop</option>
            {workshops.data?.map((workshop) => (
              <option key={workshop.id} value={workshop.id}>
                {workshop.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          PDF
          <input name="file" type="file" accept="application/pdf" />
        </label>
        <button className="full" type="submit">
          <FileUp size={18} /> Upload
        </button>
      </form>
      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}
