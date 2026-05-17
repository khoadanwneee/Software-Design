# Đặc tả: Đăng ký workshop

## Mô tả

Sinh viên đăng ký workshop miễn phí/có phí. Hệ thống chống overbooking, chống duplicate và hỗ trợ idempotency.

## Luồng miễn phí

1. Student gọi `POST /api/registrations`.
2. API kiểm tra student đã verify qua dữ liệu import.
3. Transaction giữ chỗ bằng atomic update.
4. Tạo registration `CONFIRMED` + QR token.
5. Publish notification event.

## Luồng có phí

1. Student gọi `POST /api/registrations/paid`.
2. API tạo hoặc tái sử dụng registration/payment attempt theo trạng thái hiện có.
3. Trả payment URL khi cần thanh toán.
4. Khi verify callback thành công: registration `CONFIRMED`, tạo QR, publish notification.

## Lỗi và xử lý

* Hết chỗ: trả conflict.
* Student chưa verify: bị chặn.
* Duplicate request: trả kết quả idempotent.

## Ràng buộc

* Không vượt capacity.
* Source of truth là PostgreSQL transaction.
* Mỗi user/workshop chỉ có một registration logic hợp lệ theo trạng thái.

## Tiêu chí chấp nhận

* Không overbook khi concurrent đăng ký.
* Retry không tạo bản ghi trùng.
* Workshop có phí và miễn phí đều đi đúng trạng thái nghiệp vụ.
