# Đặc tả: AI Summary từ PDF

## Mô tả

Organizer/Admin upload PDF workshop để hệ thống tạo tóm tắt AI bất đồng bộ.

## Luồng chính

1. Organizer/Admin tải lên tài liệu PDF của workshop từ giao diện quản trị.
2. Hệ thống kiểm tra tính hợp lệ của file (định dạng PDF, dung lượng cho phép, nội dung không rỗng).
3. Hệ thống lưu trữ tài liệu và tạo yêu cầu tóm tắt ở trạng thái `PENDING`.
4. Yêu cầu được đưa vào hàng đợi xử lý bất đồng bộ.
5. Worker trích xuất nội dung, làm sạch dữ liệu, gọi AI để tạo tóm tắt.
6. Hệ thống cập nhật trạng thái `PROCESSING` trong lúc xử lý và `DONE`/`FAILED` khi kết thúc.

## Trạng thái chính

* `PENDING`
* `PROCESSING`
* `DONE`
* `FAILED`

## Lỗi và xử lý

* PDF không hợp lệ/quá kích thước: từ chối ngay khi upload.
* PDF ít nội dung để tóm tắt: đánh dấu `FAILED` và ghi nhận lý do.
* Worker/AI lỗi: hệ thống tự động thử lại theo chính sách; hết số lần thử thì `FAILED`, không ảnh hưởng luồng workshop/registration khác.

## Ràng buộc

* Luồng AI phải async.
* Cần lưu thông tin để truy vết (file, status, attempts, error message).

## Tiêu chí chấp nhận

* Upload hợp lệ tạo job.
* Worker thành công thì workshop detail hiển thị summary.
* Worker thất bại vẫn giữ hệ thống hoạt động bình thường.
* Khi job chưa xử lý xong thì job không bị mất.
