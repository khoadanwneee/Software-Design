import { CheckCircle2, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import { AiSummaryStatus } from "@unihub/shared-types";

interface AiSummaryRichTextProps {
  summary: string;
}

export function AiSummaryRichText({ summary }: AiSummaryRichTextProps) {
  const blocks = summary
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="ai-summary-rich">
      {blocks.map((block, index) => {
        const lines = block
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const bulletLines = lines
          .map((line) => line.match(/^[-*•]\s+(.+)$/)?.[1]?.trim())
          .filter((line): line is string => Boolean(line));
        const numberedLines = lines
          .map((line) => line.match(/^\d+[.)]\s+(.+)$/)?.[1]?.trim())
          .filter((line): line is string => Boolean(line));

        if (bulletLines.length === lines.length) {
          return (
            <ul key={index}>
              {bulletLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          );
        }

        if (numberedLines.length === lines.length) {
          return (
            <ol key={index}>
              {numberedLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={line}>
                {lineIndex > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function AiSummaryStatusBadge({ status }: { status?: AiSummaryStatus | null }) {
  if (status === AiSummaryStatus.DONE) {
    return (
      <span className="badge ai-done">
        <CheckCircle2 size={14} /> AI summary
      </span>
    );
  }

  if (status === AiSummaryStatus.PENDING || status === AiSummaryStatus.PROCESSING) {
    return (
      <span className="badge ai-processing">
        <Clock3 size={14} /> AI đang xử lý
      </span>
    );
  }

  if (status === AiSummaryStatus.FAILED) {
    return (
      <span className="badge ai-failed">
        <TriangleAlert size={14} /> AI lỗi
      </span>
    );
  }

  return (
    <span className="badge ai-empty">
      <Sparkles size={14} /> Chưa có AI summary
    </span>
  );
}

export function aiSummaryStatusText(status?: AiSummaryStatus | null) {
  if (status === AiSummaryStatus.DONE) {
    return "AI summary đã hoàn tất.";
  }
  if (status === AiSummaryStatus.PROCESSING) {
    return "AI đang đọc PDF và tạo tóm tắt.";
  }
  if (status === AiSummaryStatus.PENDING) {
    return "PDF đã được nhận. AI summary đang chờ worker xử lý.";
  }
  if (status === AiSummaryStatus.FAILED) {
    return "AI summary thất bại. Vui lòng kiểm tra worker hoặc thử upload lại.";
  }
  return "Chưa có AI summary.";
}
