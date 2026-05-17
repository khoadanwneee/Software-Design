# Đặc tả: Workshop

## Mô tả

Quản lý danh sách workshop, chi tiết workshop, seat availability và thay đổi thông tin bởi organizer/admin.

## Luồng student

* Xem danh sách workshop có filter.
* Xem chi tiết workshop.
* Nhận cập nhật ghế qua SSE/polling.

## Luồng organizer/admin

* Tạo/sửa/hủy workshop.
* Upload PDF AI summary.
* Quản lý phòng liên quan.

## Lỗi và xử lý

* Workshop không tồn tại: 404.
* Xung đột lịch/phòng: conflict.
* Capacity thấp hơn số đăng ký: conflict.

## Ràng buộc

* Student chỉ thấy workshop công khai theo rule hiện hành.
* Seat consistency dựa trên DB transaction.
* Thay đổi workshop ảnh hưởng user đăng ký phải phát event thông báo.

## Tiêu chí chấp nhận

* CRUD workshop hoạt động đúng quyền.
* Không tạo workshop trùng lịch phòng.
* Seat update phản ánh đúng dữ liệu backend.
