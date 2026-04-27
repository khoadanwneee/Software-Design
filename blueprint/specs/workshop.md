# Đặc tả: Workshop

## Mô tả

Tính năng workshop phục vụ sinh viên và ban tổ chức. Sinh viên xem danh sách, xem chi tiết, số chỗ còn lại theo thời gian thực hoặc gần thời gian thực. Ban tổ chức tạo, cập nhật, đổi phòng, đổi giờ và hủy workshop.

## Luồng chính

### Sinh viên xem danh sách

1. Sinh viên mở Student Web App.
2. App gọi `GET /workshops` với filter ngày, phòng, category hoặc keyword.
3. Backend kiểm tra quyền đọc công khai cho user đã đăng nhập.
4. Workshop Module đọc PostgreSQL, kết hợp cache Redis nếu có.
5. Backend trả danh sách workshop PUBLISHED gồm thời gian, phòng, diễn giả, giá, trạng thái còn chỗ.
6. App subscribe WebSocket/SSE hoặc polling endpoint để cập nhật số chỗ.

### Sinh viên xem chi tiết

1. Sinh viên chọn một workshop.
2. App gọi `GET /workshops/:id`.
3. Backend trả title, description, speakers, room, room layout, price, status, registered_count, capacity, AI summary status.
4. Nếu workshop đã hủy, app hiển thị trạng thái hủy và không cho đăng ký.

### Ban tổ chức tạo/cập nhật/hủy

1. Organizer mở Admin Web App.
2. Admin Web gọi API tạo/sửa/hủy workshop.
3. Backend RBAC guard kiểm tra role `ORGANIZER` hoặc `ADMIN`.
4. Workshop Module validate thời gian, phòng, capacity, giá và trạng thái.
5. Backend ghi PostgreSQL và audit log.
6. Nếu đổi phòng/giờ/hủy workshop đã có người đăng ký, hệ thống publish notification event.

Component tham gia:

- Student Web App.
- Admin Web App.
- Backend API.
- Workshop Module.
- PostgreSQL.
- Redis.
- Message Broker.
- Notification Worker.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Workshop không tồn tại | Trả 404. |
| Workshop DRAFT bị student truy cập | Trả 404 hoặc 403 để tránh lộ dữ liệu chưa công bố. |
| Phòng bị trùng giờ | Trả 409, nêu workshop/phòng đang conflict cho organizer. |
| Capacity lớn hơn sức chứa phòng | Trả 400 hoặc yêu cầu admin override kèm audit. |
| Capacity mới nhỏ hơn số registration confirmed | Trả 409, không cho giảm nếu không có policy xử lý. |
| Đổi phòng/giờ khi notification provider lỗi | Vẫn cập nhật workshop, notification event retry async. |
| Redis cache lỗi | Backend fallback đọc PostgreSQL, response có thể chậm hơn. |

## Ràng buộc

- Chỉ `PUBLISHED` workshop mới hiển thị cho sinh viên.
- `start_time` phải nhỏ hơn `end_time`.
- Một phòng không được có hai workshop overlap cùng thời gian.
- Số chỗ còn lại có thể near real-time, nhưng registration transaction luôn dựa trên PostgreSQL.
- Thay đổi quan trọng như đổi phòng, đổi giờ, hủy phải publish notification event.
- Hủy workshop có phí phải tạo payment/refund follow-up nếu có payment PAID.

## Tiêu chí chấp nhận

- [ ] Given có workshop PUBLISHED, When sinh viên xem danh sách, Then thấy workshop và số chỗ còn lại.
- [ ] Given workshop DRAFT, When sinh viên gọi detail, Then không xem được.
- [ ] Given organizer tạo workshop trùng phòng/giờ, When submit, Then nhận 409.
- [ ] Given organizer đổi giờ workshop đã có đăng ký, When lưu thành công, Then notification event được publish.
- [ ] Given workshop bị hủy, When sinh viên mở detail, Then app hiển thị trạng thái hủy và không có nút đăng ký.
- [ ] Given registered_count thay đổi, When student đang xem danh sách, Then số chỗ được cập nhật qua realtime hoặc polling.
