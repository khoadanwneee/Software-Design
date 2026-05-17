# Đặc tả: Nhập dữ liệu sinh viên từ CSV

## Mô tả

Hệ thống import CSV sinh viên để xác minh profile student và phục vụ điều kiện đăng ký.

## Luồng chính (admin upload)

1. Admin tải lên file CSV từ giao diện quản trị và khai báo thông tin import (loại import, mô tả, chế độ dry-run nếu cần).
2. Hệ thống kiểm tra file CSV hợp lệ (định dạng, dung lượng, không rỗng).
3. Hệ thống đối chiếu file với các import đã có để tránh trùng lặp theo nội dung và loại import.
4. Nếu trùng thì dùng lại import run hiện có; nếu không trùng thì lưu file và tạo import run ở trạng thái `PENDING`.
5. Import run được đưa vào hàng đợi xử lý bất đồng bộ.
6. Worker đọc CSV, validate từng dòng, upsert dữ liệu, ghi lỗi theo dòng và cập nhật trạng thái `DONE`/`DONE_WITH_ERRORS`/`FAILED`.

## Luồng upload định kỳ (scheduler)

1. Hệ thống có thể bật cơ chế quét thư mục CSV định kỳ nếu được cấu hình.
2. Đến mỗi chu kỳ, hệ thống lấy danh sách file CSV mới trong thư mục theo thứ tự ổn định.
3. Với mỗi file, hệ thống tạo import run tự động (loại import định kỳ, mô tả nguồn dữ liệu).
4. File đã từng được import theo cùng loại thì bỏ qua để tránh lặp.
5. Import run được đưa vào hàng đợi và xử lý giống như luồng upload thủ công.

## Lỗi và xử lý

* File lỗi format/header: run `FAILED`.
* Dòng lỗi: ghi row error, run có thể `DONE_WITH_ERRORS`.

## Ràng buộc

* Import chạy async qua worker.
* Không được làm gián đoạn luồng API chính.
* Có log đầy đủ để truy vết.

## Tiêu chí chấp nhận

* Import hợp lệ cập nhật dữ liệu đúng.
* Import lỗi vẫn có báo cáo chi tiết theo dòng.
