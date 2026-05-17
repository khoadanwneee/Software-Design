# UniHub Workshop — Project Proposal

## Bối cảnh

UniHub là hệ thống quản lý workshop dành cho sinh viên, hỗ trợ:

* Xem danh sách workshop.
* Đăng ký tham gia workshop.
* Thanh toán workshop có phí.
* Nhận mã QR check-in.
* Check-in tại sự kiện.
* Nhận thông báo hệ thống.
* Xem AI summary từ tài liệu workshop.
* Import dữ liệu sinh viên từ file CSV.

Hệ thống được thiết kế theo hướng xử lý bất đồng bộ và hỗ trợ tải đồng thời lớn trong môi trường nhiều người dùng.

## Mục tiêu

* Ngăn chặn overbooking khi nhiều sinh viên đăng ký cùng lúc.
* Hỗ trợ workshop miễn phí và có phí với cơ chế idempotency để tránh thanh toán hoặc đăng ký trùng.
* Hỗ trợ check-in online/offline ổn định trên mobile.
* Đảm bảo notification chạy bất đồng bộ, không ảnh hưởng luồng chính.
* Hỗ trợ import CSV và AI summary thông qua hàng đợi xử lý nền.

## Vai trò

| Vai trò         | Quyền                                                        |
| --------------- | ------------------------------------------------------------ |
| `STUDENT`       | Xem workshop, đăng ký, thanh toán, xem QR, xem thông báo     |
| `CHECKIN_STAFF` | Check-in bằng mobile, hỗ trợ đồng bộ offline                 |
| `ORGANIZER`     | Quản lý workshop/phòng, upload PDF AI summary, xem thống kê  |
| `ADMIN`         | Toàn quyền organizer + quản lý user/role và import sinh viên |

## Phạm vi hiện tại

### Web (`apps/web`)

* Giao diện cho:

  * Student.
  * Admin/Organizer.
* Không còn hỗ trợ check-in trên web.
* Tập trung vào:

  * Quản lý workshop.
  * Dashboard thống kê.
  * Đăng ký workshop.
  * Quản trị hệ thống.

### Mobile (`apps/mobile`)

* Dành cho check-in staff.
* Hỗ trợ:

  * Check-in online.
  * Check-in offline.
  * Đồng bộ dữ liệu khi có mạng trở lại.

### API (`apps/api`)

* Cung cấp REST API cho web/mobile.
* Xử lý:

  * Authentication & RBAC.
  * Đăng ký workshop.
  * Thanh toán.
  * QR check-in.
  * Notification.
  * Dashboard/admin APIs.

### Worker (`apps/worker`)

* Xử lý background jobs bằng BullMQ:

  * Notification queue.
  * CSV import queue.
  * AI summary queue.
  * Đồng bộ trạng thái workshop.
  * Retry tác vụ thất bại.

## Công nghệ sử dụng

| Thành phần    | Công nghệ         |
| ------------- | ----------------- |
| Frontend Web  | Next.js           |
| Mobile        | React Native      |
| Backend API   | Node.js + Express |
| Database      | PostgreSQL        |
| Cache / Queue | Redis             |
| Job Queue     | BullMQ            |
| ORM           | Prisma            |

## Kiến trúc và định hướng kỹ thuật

### Chống overbooking

* Sử dụng transaction database kết hợp kiểm tra slot còn lại.
* Đảm bảo nhiều request đồng thời không vượt quá sức chứa workshop.

### Idempotency cho thanh toán/đăng ký

* Mỗi request thanh toán hoặc đăng ký sử dụng idempotency key.
* Tránh tạo nhiều registration khi client retry request.

### Check-in online/offline

* Mobile lưu queue check-in cục bộ khi mất mạng.
* Khi online trở lại, hệ thống tự đồng bộ dữ liệu về server.
* API xử lý chống check-in trùng.

### Background jobs

* Các tác vụ nặng được đẩy sang worker:

  * Gửi notification.
  * Import CSV.
  * Sinh AI summary.
* Luồng API chính phản hồi nhanh và không bị block.

### RBAC và bảo mật

* JWT authentication.
* Middleware `requireAuth` và `requireRole`.
* Backend là lớp kiểm soát quyền chính.
* Không lưu mật khẩu thô.

## Ngoài phạm vi

* Tích hợp cổng thanh toán production hoàn chỉnh.
* Waitlist nâng cao.
* Tách microservice theo domain.
* Realtime websocket quy mô lớn.