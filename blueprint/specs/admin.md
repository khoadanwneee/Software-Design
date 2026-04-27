# Đặc tả: Admin và báo cáo

## Mô tả

Tính năng admin phục vụ ban tổ chức và quản trị viên. Admin Web cho phép quản lý workshop, xem thống kê đăng ký/check-in, theo dõi import CSV, kiểm tra trạng thái AI summary/payment và xem audit log.

## Luồng chính

1. Organizer/Admin đăng nhập Admin Web.
2. Admin Web route guard kiểm tra role.
3. Backend API kiểm tra lại role bằng RBAC guard.
4. Người dùng có quyền có thể:
   - Tạo/sửa/hủy workshop.
   - Upload PDF.
   - Xem danh sách registration theo workshop.
   - Xem số check-in, no-show, revenue.
   - Xem import job status và row errors.
   - Xem audit log cho thao tác quan trọng.
5. Backend ghi audit log cho hành động thay đổi dữ liệu.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Student truy cập admin route | Client redirect/403; backend vẫn chặn 403. |
| Organizer sửa workshop không thuộc quyền | Backend trả 403. |
| Dashboard query nặng | Dùng read model/materialized view/cache; API không lock transaction chính. |
| Import job lỗi | Admin dashboard hiển thị FAILED/DONE_WITH_ERRORS và link row log. |
| Payment gateway degraded | Dashboard hiển thị circuit state hoặc cảnh báo payment temporarily unavailable. |
| Audit log ghi lỗi | Không chặn thao tác user nếu thay đổi chính đã commit, nhưng ghi system alert để điều tra. |

## Ràng buộc

- Admin Web không phải lớp bảo mật duy nhất; backend phải enforce quyền.
- Các thao tác tạo/sửa/hủy workshop, đổi role, import CSV, payment override phải có audit log.
- Dashboard thống kê có thể near real-time, không nhất thiết realtime từng giây.
- Chỉ ADMIN được quản lý user/role toàn hệ thống.
- ORGANIZER chỉ xem/sửa workshop thuộc phạm vi được giao.

## Tiêu chí chấp nhận

- [ ] Given organizer đăng nhập, When mở admin dashboard, Then xem được workshop được phân quyền.
- [ ] Given student mở admin URL, When request API, Then nhận 403.
- [ ] Given organizer hủy workshop, When thao tác thành công, Then audit log được ghi và notification event được publish.
- [ ] Given admin xem thống kê, When chọn workshop, Then thấy registered_count, checked_in_count, no_show_count.
- [ ] Given CSV import có dòng lỗi, When admin mở import detail, Then thấy row_number và error_message.
- [ ] Given admin thay đổi role user, When lưu, Then audit log ghi old/new values.
