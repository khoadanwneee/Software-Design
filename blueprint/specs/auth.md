# Đặc tả: Xác thực và phân quyền

## Mô tả

Tính năng xác thực và phân quyền phục vụ toàn bộ người dùng UniHub Workshop. Hệ thống cần đăng nhập, phát hành JWT/session, xác định vai trò và chặn truy cập trái quyền cho API, admin web và check-in mobile app.

Vai trò chuẩn:

- `STUDENT`: sinh viên.
- `ORGANIZER`: ban tổ chức.
- `CHECKIN_STAFF`: nhân sự check-in.
- `ADMIN`: quản trị viên hệ thống.

## Luồng chính

1. Người dùng mở Student Web, Admin Web hoặc Check-in Mobile App.
2. Người dùng đăng nhập bằng email/MSSV và mật khẩu hoặc cơ chế SSO/mock auth của đồ án.
3. Backend API kiểm tra thông tin đăng nhập.
4. Backend lấy user, role và trạng thái tài khoản.
5. Backend phát hành JWT hoặc session token.
6. Client lưu token theo cách an toàn phù hợp nền tảng.
7. Mỗi request sau gửi token trong header.
8. Backend middleware xác thực token.
9. RBAC guard kiểm tra role/permission theo endpoint:
   - Student endpoint yêu cầu `STUDENT`.
   - Admin workshop endpoint yêu cầu `ORGANIZER` hoặc `ADMIN`.
   - Check-in endpoint yêu cầu `CHECKIN_STAFF`, `ORGANIZER` hoặc `ADMIN`.
10. Nếu hợp lệ, request đi tiếp vào module nghiệp vụ.

Component tham gia:

- Student Web App.
- Admin Web App.
- Check-in Mobile App.
- Backend API.
- Auth/RBAC Module.
- PostgreSQL.
- Legacy CSV-imported student records.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| Sai email/MSSV hoặc mật khẩu | Trả 401, không nói rõ email hay mật khẩu sai để tránh lộ thông tin. |
| Token hết hạn | Trả 401; client yêu cầu đăng nhập lại hoặc refresh token nếu có. |
| Token bị sửa | Trả 401 và ghi security log. |
| User bị khóa | Trả 403 với thông báo tài khoản không hoạt động. |
| Student truy cập admin | Admin web route guard chặn; backend vẫn trả 403 nếu gọi API trực tiếp. |
| Check-in staff truy cập payment/admin role management | Backend trả 403. |
| Sinh viên chưa có trong CSV import | Cho phép đăng nhập tùy policy, nhưng không cho đăng ký workshop nếu chưa xác minh student profile; hoặc trả lỗi cần liên hệ ban tổ chức. |
| Legacy CSV chưa import đêm nay | Hệ thống dùng dữ liệu import gần nhất và hiển thị thời điểm dữ liệu được cập nhật. |

## Ràng buộc

- Mọi endpoint nhạy cảm phải kiểm tra quyền ở backend, không chỉ dựa vào frontend.
- Admin web và mobile app có route guard để cải thiện UX, nhưng backend guard là lớp bảo vệ chính.
- JWT/session không được chứa dữ liệu nhạy cảm ngoài user id, role và expiry.
- Password nếu dùng local auth phải hash, không lưu plain text.
- Thay đổi role phải ghi audit log.
- RBAC phải hỗ trợ mở rộng permission chi tiết sau này.

## Tiêu chí chấp nhận

- [ ] Given user nhập đúng thông tin, When đăng nhập, Then nhận token hợp lệ.
- [ ] Given token sai hoặc hết hạn, When gọi API, Then nhận 401.
- [ ] Given user role STUDENT, When gọi API tạo workshop, Then nhận 403.
- [ ] Given user role ORGANIZER, When tạo workshop hợp lệ, Then request được xử lý.
- [ ] Given user role CHECKIN_STAFF, When gọi API scan QR, Then request được xử lý nếu được phân công.
- [ ] Given admin thay đổi role user, When thao tác thành công, Then audit log được ghi.
- [ ] Given sinh viên chưa xác minh từ CSV, When đăng ký workshop, Then hệ thống chặn hoặc đưa trạng thái cần xác minh theo policy.
