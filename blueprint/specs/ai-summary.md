# Đặc tả: AI Summary từ PDF

## Mô tả

Tính năng AI Summary cho phép ban tổ chức upload PDF giới thiệu workshop. Hệ thống extract text, làm sạch văn bản, gửi sang AI Model Service để tạo bản tóm tắt và hiển thị trên trang chi tiết workshop.

## Luồng chính

1. Organizer tạo/cập nhật workshop và upload PDF.
2. Backend validate file type PDF, size limit và quyền ORGANIZER/ADMIN.
3. Backend lưu file vào Object Storage hoặc local object storage.
4. Backend tạo `uploaded_files` và `ai_summaries` status PENDING.
5. Backend publish `ai_summary.requested` vào Message Broker.
6. Worker consume job.
7. Worker tải PDF, extract text.
8. Worker clean text: bỏ header/footer rác, normalize whitespace, giới hạn độ dài.
9. Worker gọi AI Service với prompt tóm tắt tiếng Việt.
10. Worker lưu summary status DONE.
11. Student xem workshop detail sẽ thấy summary nếu DONE; nếu chưa xong thì thấy trạng thái đang xử lý hoặc mô tả gốc.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| File không phải PDF | Reject upload, trả 400. |
| File quá lớn | Reject upload theo size limit. |
| PDF hỏng hoặc không extract được text | `ai_summaries` chuyển FAILED, lưu error_message. |
| AI Service timeout | Retry có backoff; sau max attempts chuyển FAILED. |
| AI trả nội dung rỗng | Mark FAILED hoặc NEEDS_REVIEW. |
| Worker down | Job nằm trong queue và xử lý lại khi worker hồi phục. |
| AI lỗi | Trang workshop vẫn hoạt động, hiển thị mô tả gốc. |

## Ràng buộc

- AI processing phải async, không chặn request tạo/cập nhật workshop.
- Không gửi dữ liệu nhạy cảm không cần thiết sang AI.
- Cần timeout cho AI request.
- Cần lưu model/prompt version nếu muốn audit chất lượng summary.
- Organizer có thể sửa mô tả gốc; AI summary chỉ là nội dung hỗ trợ.
- AI lỗi không làm hỏng workshop hoặc registration.

## Tiêu chí chấp nhận

- [ ] Given organizer upload PDF hợp lệ, When lưu workshop, Then job AI summary được tạo.
- [ ] Given worker xử lý thành công, When student xem detail, Then thấy summary.
- [ ] Given AI timeout, When worker retry hết số lần, Then summary status FAILED và workshop vẫn xem được.
- [ ] Given file sai định dạng, When upload, Then backend trả 400.
- [ ] Given summary đang PENDING, When student xem detail, Then app hiển thị trạng thái đang xử lý hoặc mô tả gốc.
- [ ] Given worker restart, When job chưa xử lý xong, Then job không mất.
