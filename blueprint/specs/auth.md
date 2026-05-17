# Đặc tả: Xác thực và phân quyền

## Mô tả

Cung cấp đăng nhập bằng email/mật khẩu, phát JWT và kiểm soát truy cập theo role cho API, web và mobile.

## Luồng chính

1. Người dùng đăng nhập qua `POST /api/auth/login`.
2. API kiểm tra tài khoản, mật khẩu hash và trạng thái user.
3. API trả `accessToken` + thông tin user.
4. Client gửi token ở header `Authorization: Bearer ...`.
5. API xác thực token qua `requireAuth`.
6. API kiểm tra quyền qua `requireRole` cho endpoint cần role.

## Vai trò

* `STUDENT`
* `ORGANIZER`
* `CHECKIN_STAFF`
* `ADMIN`

## Lỗi và xử lý

* Sai tài khoản/mật khẩu: `401`.
* Token sai/hết hạn: `401`.
* Tài khoản không `ACTIVE`: `403`.
* Không đủ quyền: `403`.

## Ràng buộc

* Không dựa vào frontend để bảo vệ quyền, backend là nguồn kiểm soát chính.
* Không lưu mật khẩu thô.

## Tiêu chí chấp nhận

* Đăng nhập đúng trả token hợp lệ.
* Token sai/hết hạn bị chặn.
* Role không phù hợp bị chặn đúng endpoint.
