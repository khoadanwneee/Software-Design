# Đặc tả: Notification

## Mô tả

Notification chạy bất đồng bộ qua worker, không rollback nghiệp vụ chính nếu gửi thất bại.

## Kênh hiện tại

* In-app
* Email
* Telegram (placeholder/chưa cấu hình thực gửi)

## Luồng chính

1. API publish notification job (ví dụ `registration.confirmed`, `workshop.changed`, `workshop.cancelled`).
2. Worker consume job.
3. Resolve người nhận theo user trực tiếp hoặc danh sách registration đã confirm.
4. Đọc preference theo user.
5. Render template theo event + channel.
6. Gửi theo channel adapter.
7. Lưu `notifications` và `notification_deliveries`.
8. Retry theo policy khi provider lỗi.

## Lỗi và xử lý

* Provider timeout/lỗi: retry, không ảnh hưởng transaction nghiệp vụ gốc.
* Template thiếu biến: đánh dấu `FAILED_TEMPLATE`.
* Event/job trùng: dedupe theo `dedupeKey`.
* Telegram chưa bật: `SKIPPED`/`CHANNEL_DISABLED`.

## Ràng buộc

* Notification không được nằm trong transaction chính của đăng ký/thanh toán/check-in.
* Phải tôn trọng preference user.
* Phải lưu log delivery để truy vết.

## Tiêu chí chấp nhận

* Event hợp lệ tạo notification in-app/email đúng preference.
* Retry hoạt động khi provider lỗi.
* Dedupe ngăn gửi trùng.
