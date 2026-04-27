# Đặc tả: Đăng ký workshop

## Mô tả

Tính năng đăng ký cho phép sinh viên đăng ký workshop miễn phí và nhận QR sau khi thành công. Registration phải chống overbooking, chống đăng ký trùng và xử lý request retry bằng idempotency key.

## Luồng chính

1. Sinh viên mở chi tiết workshop miễn phí.
2. Student Web App gửi `POST /registrations` với `workshop_id` và `idempotency_key`.
3. Backend xác thực user role STUDENT.
4. Registration Module kiểm tra:
   - Workshop tồn tại và PUBLISHED.
   - Workshop chưa hủy/chưa kết thúc.
   - Sinh viên chưa đăng ký workshop này.
   - Sinh viên đã được xác minh từ dữ liệu student import.
5. Backend bắt đầu transaction.
6. Backend chạy atomic update tăng `registered_count` nếu còn chỗ.
7. Nếu update thành công, backend tạo registration `CONFIRMED`.
8. Backend tạo QR token `ACTIVE` cho registration.
9. Backend commit transaction.
10. Backend publish `registration.confirmed` và `seat.updated`.
11. Student Web hiển thị QR và trạng thái đăng ký thành công.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Workshop hết chỗ | Atomic update ảnh hưởng 0 dòng; rollback, trả 409. |
| Sinh viên bấm đăng ký nhiều lần | Cùng `idempotency_key` trả kết quả cũ; unique `user_id + workshop_id` chặn duplicate. |
| Workshop bị hủy giữa lúc đăng ký | Transaction kiểm tra status; trả 409 hoặc 400. |
| Sinh viên chưa xác minh | Trả 403/409 với thông báo cần xác minh dữ liệu sinh viên. |
| Tạo QR lỗi sau khi registration tạo | Prefer tạo QR trong cùng transaction; nếu lỗi sau commit thì tạo recovery job và trạng thái QR_PENDING. |
| Notification lỗi | Registration vẫn thành công; notification retry async. |

## Ràng buộc

- Không được vượt quá `capacity`.
- PostgreSQL là source of truth cho capacity, không chỉ dựa vào Redis.
- QR chỉ được tạo cho registration `CONFIRMED`.
- QR token không chứa MSSV/email; chỉ là token ngẫu nhiên hoặc hash.
- Một sinh viên chỉ có một registration active/confirmed cho một workshop.
- Endpoint đăng ký phải có rate limit riêng để bảo vệ hệ thống.

Atomic update bắt buộc:

```sql
UPDATE workshops
SET registered_count = registered_count + 1
WHERE id = :workshop_id
  AND registered_count < capacity;
-- chỉ tạo registration nếu số dòng bị ảnh hưởng = 1, trong cùng transaction
```

## Tiêu chí chấp nhận

- [ ] Given workshop còn chỗ, When sinh viên đăng ký, Then registration CONFIRMED và QR ACTIVE được tạo.
- [ ] Given workshop chỉ còn 1 chỗ và 2 request đồng thời, When xử lý, Then chỉ 1 request thành công.
- [ ] Given sinh viên đã đăng ký, When gửi request lại, Then không tạo registration thứ hai.
- [ ] Given idempotency_key đã xử lý, When retry cùng key, Then trả kết quả cũ.
- [ ] Given notification provider lỗi, When registration thành công, Then registration không bị rollback.
- [ ] Given workshop hết chỗ, When sinh viên đăng ký, Then nhận thông báo hết chỗ.
