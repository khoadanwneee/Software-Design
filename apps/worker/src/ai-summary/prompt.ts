export const AI_SUMMARY_PROMPT_VERSION = "summary-vi-v1";
export const INSUFFICIENT_CONTENT_MESSAGE = "Không đủ nội dung để tạo tóm tắt chất lượng.";

export interface WorkshopPdfPromptInput {
  title?: string | null;
  description?: string | null;
  pdfText: string;
}

export function buildWorkshopPdfSummaryPrompt(input: WorkshopPdfPromptInput) {
  return `Bạn là trợ lý tóm tắt nội dung workshop cho sinh viên đại học.

Hãy đọc nội dung PDF dưới đây và tạo bản tóm tắt tiếng Việt cho trang chi tiết workshop.

Yêu cầu:
- Tóm tắt trung thực dựa trên nội dung được cung cấp.
- Không bịa thông tin không có trong tài liệu.
- Văn phong rõ ràng, thân thiện với sinh viên.
- Nêu rõ workshop nói về chủ đề gì, người học nhận được gì, và ai nên tham gia nếu có đủ thông tin.
- Độ dài 120-180 từ.
- Không nhắc đến việc “PDF nói rằng” hoặc “tài liệu này”.
- Nếu nội dung quá ít hoặc không đủ ý nghĩa, trả về chính xác: "${INSUFFICIENT_CONTENT_MESSAGE}"

Thông tin workshop:
Title: ${input.title ?? ""}
Description hiện có: ${input.description ?? ""}

Nội dung trích xuất từ PDF:
${input.pdfText}`;
}

export function isInsufficientContentSummary(summary: string) {
  return summary.trim().toLowerCase() === INSUFFICIENT_CONTENT_MESSAGE.toLowerCase();
}
