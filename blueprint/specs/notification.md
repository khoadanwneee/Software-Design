# Đặc tả: Notification

## Mô tả

Tính năng notification gửi xác nhận đăng ký, thông báo đổi phòng/giờ, hủy workshop và nhắc lịch qua app/email. Thiết kế phải mở rộng được sang Telegram mà ít thay đổi core logic.

## Luồng chính

1. Module nghiệp vụ publish event vào Message Broker, ví dụ `registration.confirmed`, `workshop.changed`, `workshop.cancelled`.
2. Worker Service consume event.
3. Notification Service xác định người nhận.
4. Service đọc notification preference của user.
5. Service render template theo channel.
6. Service gửi qua channel tương ứng:
   - In-app notification.
   - Email provider.
   - Future Telegram adapter.
7. Service ghi `notifications` và `notification_deliveries`.
8. Nếu gửi thất bại, worker retry theo backoff.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Email provider timeout | Mark attempt FAILED, retry sau; registration không rollback. |
| User tắt email | Không gửi email, có thể gửi in-app nếu bật. |
| Template thiếu biến | Mark FAILED_TEMPLATE, alert admin/dev. |
| Message Broker gửi lại event | Dùng `dedupe_key` để tránh gửi trùng. |
| Telegram chưa cấu hình | Channel disabled; core flow không đổi. |
| Notification worker down | Event vẫn nằm trong queue; worker xử lý khi hồi phục. |

## Ràng buộc

- Notification không được nằm trong transaction chính của registration/payment/check-in.
- Gửi email lỗi không làm đăng ký thất bại.
- Mỗi notification cần `dedupe_key` để tránh gửi trùng do retry.
- Channel abstraction phải cho phép thêm Telegram bằng adapter mới.
- User preference phải được tôn trọng.
- Cần log delivery để admin kiểm tra sự cố.

## Tiêu chí chấp nhận

- [ ] Given registration.confirmed event, When worker xử lý, Then student nhận in-app notification và email nếu bật.
- [ ] Given email provider lỗi, When gửi thất bại, Then job retry và registration vẫn CONFIRMED.
- [ ] Given event duplicate, When worker consume lại, Then không gửi notification trùng nếu dedupe_key đã tồn tại.
- [ ] Given user tắt email, When có event, Then không gửi email cho user đó.
- [ ] Given thêm TelegramChannel adapter, When channel enabled, Then core Notification Service không cần sửa orchestration chính.
- [ ] Given workshop đổi phòng, When event publish, Then các sinh viên đã đăng ký nhận thông báo.
