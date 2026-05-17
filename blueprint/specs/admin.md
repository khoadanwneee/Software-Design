# Đặc tả: Admin và thống kê

## Mô tả

Hệ thống cung cấp trang quản trị dành cho `ADMIN` và `ORGANIZER` trên nền tảng web để quản lý workshop, phòng học, người dùng, import sinh viên, AI summary và theo dõi thống kê tổng quan của hệ thống.

## Chức năng chính

### Dashboard thống kê

* Hiển thị thống kê tổng quan:

  * Tổng số workshop.
  * Tổng số người dùng.
  * Tổng số lượt đăng ký.
  * Tỷ lệ check-in.
  * Trạng thái workshop.
* Hiển thị dữ liệu theo thời gian hoặc theo workshop.

### Quản lý workshop và phòng

* Tạo, cập nhật, hủy workshop.
* Quản lý thông tin phòng tổ chức.
* Gán phòng cho workshop.
* Theo dõi trạng thái workshop:

  * `DRAFT`
  * `PUBLISHED`
  * `CANCELLED`
  * `COMPLETED`

### Quản lý người dùng

* Xem danh sách người dùng.
* Tạo tài khoản nhân sự/admin.
* Cập nhật:

  * Role.
  * Trạng thái tài khoản.
* Khóa hoặc mở khóa tài khoản.

### Theo dõi import sinh viên

* Theo dõi lịch sử import dữ liệu sinh viên.
* Xem trạng thái import:

  * Thành công.
  * Thất bại.
  * Đang xử lý.
* Hiển thị lỗi dữ liệu nếu import thất bại.

### Theo dõi AI Summary

* Xem trạng thái tạo AI summary cho workshop.
* Theo dõi:

  * Đã xử lý.
  * Đang xử lý.
  * Thất bại.
* Xem nội dung summary đã sinh.

## Phân quyền

| Vai trò         | Quyền                                                     |
| --------------- | --------------------------------------------------------- |
| `ADMIN`         | Toàn quyền quản trị hệ thống                              |
| `ORGANIZER`     | Quản lý workshop, phòng, AI summary và thống kê liên quan |
| `CHECKIN_STAFF` | Không được truy cập trang quản trị                        |
| `STUDENT`       | Không được truy cập trang quản trị                        |


## Lỗi và xử lý

* User không đủ quyền truy cập admin: 403.
* Dữ liệu nghiệp vụ lỗi vẫn phải có phản hồi rõ ràng theo chuẩn API.

## Ràng buộc

* Backend RBAC là lớp bảo vệ bắt buộc.
* Các thao tác quan trọng cần audit log.

## Tiêu chí chấp nhận

* Role đúng truy cập đúng màn hình/endpoint.
* Role sai bị chặn nhất quán ở cả web guard và API.


