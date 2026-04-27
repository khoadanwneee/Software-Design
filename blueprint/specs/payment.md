# Đặc tả: Thanh toán workshop có phí

## Mô tả

Tính năng payment hỗ trợ đăng ký workshop có phí qua Payment Gateway mock/sandbox. Hệ thống phải xử lý timeout, retry an toàn, circuit breaker và idempotency key để không trừ tiền hoặc xác nhận registration hai lần.

## Luồng chính

1. Sinh viên bấm đăng ký workshop có phí.
2. Student Web gửi `POST /registrations/paid` với `workshop_id` và `idempotency_key`.
3. Backend validate workshop, student, capacity và tạo registration `PENDING_PAYMENT`.
4. Payment Module tạo payment attempt `PENDING` với unique `idempotency_key`.
5. Backend gọi Payment Gateway tạo payment session.
6. Student Web redirect sinh viên sang payment URL.
7. Payment Gateway gửi webhook về Backend API.
8. Payment Module verify signature, event id và provider transaction id.
9. Nếu webhook success:
   - Payment chuyển `PAID`.
   - Registration chuyển `CONFIRMED`.
   - QR token được tạo.
   - Notification event được publish.
10. Nếu webhook failed:
   - Payment chuyển `FAILED`.
   - Registration chuyển `CANCELLED` hoặc `PAYMENT_FAILED`.
   - Chỗ giữ tạm được release nếu có.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Gateway timeout khi tạo payment intent | Payment attempt giữ `PENDING` hoặc `INIT_FAILED`; client nhận thông báo thử lại an toàn. |
| Gateway lỗi liên tiếp | Circuit breaker chuyển Open; paid registration tạm bị chặn, xem workshop vẫn hoạt động. |
| User đóng app giữa chừng | Webhook vẫn cập nhật trạng thái; khi mở lại app gọi status API. |
| Webhook duplicate | Unique provider event/transaction id làm no-op; trả 200 cho gateway. |
| Retry cùng idempotency key | Trả payment attempt cũ, không gọi gateway tạo attempt mới. |
| Payment success nhưng hết chỗ | Nếu không dùng seat hold hoặc hold hết hạn, tạo refund/needs_review; không xác nhận trùng. |
| Payment success nhưng tạo QR lỗi | Lưu trạng thái cần recovery, retry QR generation, alert admin nếu vẫn lỗi. |
| Webhook signature invalid | Ghi callback INVALID, không cập nhật payment/registration. |

## Ràng buộc

- Không tin browser redirect là bằng chứng thanh toán.
- Payment `PAID` chỉ đến từ webhook đã verify hoặc reconciliation đã xác minh.
- Không lưu raw card data.
- `payments.idempotency_key` phải unique.
- `payment_callbacks` phải lưu raw payload/hash để audit.
- Payment Gateway lỗi không được làm ảnh hưởng `GET /workshops`, đăng ký miễn phí, xem QR cũ, check-in.
- Circuit breaker có ba trạng thái Closed/Open/Half-Open.

## Tiêu chí chấp nhận

- [ ] Given workshop có phí còn chỗ, When sinh viên tạo payment intent, Then có registration PENDING_PAYMENT và payment PENDING.
- [ ] Given webhook success hợp lệ, When xử lý, Then payment PAID, registration CONFIRMED và QR ACTIVE.
- [ ] Given webhook duplicate, When xử lý lại, Then không tạo QR/notification/registration mới.
- [ ] Given retry cùng idempotency_key, When gọi payment intent, Then trả payment attempt cũ.
- [ ] Given gateway lỗi vượt ngưỡng, When tạo payment mới, Then API trả payment temporarily unavailable.
- [ ] Given gateway lỗi, When sinh viên xem danh sách workshop, Then vẫn xem được.
- [ ] Given signature webhook invalid, When callback đến, Then payment không đổi trạng thái.
