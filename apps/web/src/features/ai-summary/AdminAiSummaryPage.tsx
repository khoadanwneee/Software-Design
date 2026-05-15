import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { api } from "../../lib/api";

export function AdminAiSummaryPage() {
  const queryClient = useQueryClient();
  const [workshopId, setWorkshopId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const workshops = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;
    if (!file || !workshopId) {
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const uploadForm = new FormData();
      uploadForm.set("file", file);
      const result = await api.aiSummaryApi.uploadPdf(workshopId, uploadForm);
      setMessage(`AI job ${result.status}: ${result.aiSummaryId}`);
      await queryClient.invalidateQueries({ queryKey: ["workshops"] });
      await queryClient.invalidateQueries({ queryKey: ["workshop", workshopId] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
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
        <button className="full" type="submit" disabled={uploading}>
          <FileUp size={18} /> Upload
        </button>
      </form>
      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}
