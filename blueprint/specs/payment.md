# Đặc tả: Thanh toán workshop có phí

## Mô tả

Hỗ trợ thanh toán cho workshop có phí với idempotency, callback verification và xử lý retry/reconcile.

## Luồng chính

1. Tạo payment attempt từ luồng registration paid.
2. Redirect người dùng sang payment URL.
3. Callback/verify cập nhật trạng thái payment.
4. Nếu thành công: xác nhận registration, tạo QR, phát notification.
5. Worker reconcile định kỳ cho payment bất thường.

## Lỗi và xử lý

* Timeout/provider lỗi: không làm chết flow xem workshop.
* Callback trùng: idempotent.
* Giao dịch thất bại: cập nhật trạng thái phù hợp (`FAILED`, `EXPIRED`, `NEEDS_MANUAL_REVIEW`, ...).

## Ràng buộc

* Không tin redirect browser là kết quả thanh toán cuối cùng.
* Không tạo trùng payment/registration khi retry cùng ngữ cảnh idempotency.

## Tiêu chí chấp nhận

* Payment success cập nhật đúng registration + QR.
* Payment failure không phá vỡ dữ liệu hệ thống.
* Reconcile xử lý được trạng thái pending kéo dài.
