import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, RefreshCw } from "lucide-react";
import { AiSummaryStatus } from "@unihub/shared-types";
import { api } from "../../lib/api";
import { AiSummaryRichText, AiSummaryStatusBadge, aiSummaryStatusText } from "./AiSummaryRichText";

interface ActiveUpload {
  aiSummaryId: string;
  workshopId: string;
}

export function AdminAiSummaryPage() {
  const queryClient = useQueryClient();
  const [workshopId, setWorkshopId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(null);
  const workshops = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });
  const aiSummary = useQuery({
    queryKey: ["ai-summary", activeUpload?.aiSummaryId],
    queryFn: () => api.aiSummaryApi.detail(activeUpload!.aiSummaryId),
    enabled: Boolean(activeUpload?.aiSummaryId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === AiSummaryStatus.PENDING || status === AiSummaryStatus.PROCESSING ? 1500 : false;
    }
  });

  useEffect(() => {
    if (!activeUpload || !aiSummary.data) {
      return;
    }

    if (aiSummary.data.status === AiSummaryStatus.DONE) {
      setMessage("AI summary đã hoàn tất và đã được lưu vào workshop.");
      void queryClient.invalidateQueries({ queryKey: ["workshops"] });
      void queryClient.invalidateQueries({ queryKey: ["workshop", activeUpload.workshopId] });
    }

    if (aiSummary.data.status === AiSummaryStatus.FAILED) {
      setMessage("AI summary thất bại. Vui lòng kiểm tra worker/ngrok hoặc upload lại PDF.");
    }
  }, [activeUpload, aiSummary.data, queryClient]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;
    if (!file || !workshopId) {
      return;
    }

    setUploading(true);
    setMessage(null);
    setActiveUpload(null);
    try {
      const uploadForm = new FormData();
      uploadForm.set("file", file);
      const result = await api.aiSummaryApi.uploadPdf(workshopId, uploadForm);
      setMessage("PDF đã được nhận. AI summary đang xử lý, bạn có thể ở lại trang này để xem kết quả.");
      setActiveUpload({ aiSummaryId: result.aiSummaryId, workshopId });
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
                {workshop.aiSummary?.status === AiSummaryStatus.DONE ? "✓ " : ""}
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
      {aiSummary.data ? (
        <section className="ai-summary-result" aria-live="polite">
          <div className="ai-summary-result-header">
            <AiSummaryStatusBadge status={aiSummary.data.status} />
            <span>{aiSummaryStatusText(aiSummary.data.status)}</span>
            {aiSummary.isFetching ? <RefreshCw className="spin" size={16} /> : null}
          </div>
          {aiSummary.data.status === AiSummaryStatus.DONE && aiSummary.data.summary ? (
            <AiSummaryRichText summary={aiSummary.data.summary} />
          ) : null}
          {aiSummary.data.status === AiSummaryStatus.FAILED && aiSummary.data.errorMessage ? (
            <p className="error">{aiSummary.data.errorMessage}</p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
