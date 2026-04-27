# Đặc tả: Nhập dữ liệu sinh viên từ CSV

## Mô tả

Legacy Student System không có API và chỉ export CSV ban đêm. UniHub cần import CSV định kỳ để xác thực sinh viên, cập nhật thông tin email, ngành/lớp và phục vụ phân quyền/đăng ký.

## Luồng chính

1. Legacy Student System xuất CSV ban đêm vào thư mục import hoặc Object Storage.
2. Scheduler hoặc admin tạo `csv_import_jobs`.
3. Worker đọc file CSV.
4. Worker validate schema file:
   - Có header đúng.
   - Có cột bắt buộc `student_code`, `email`, `full_name`.
   - Encoding đọc được.
5. Worker validate từng dòng:
   - `student_code` đúng format.
   - email hợp lệ.
   - field bắt buộc không rỗng.
6. Worker upsert `students` theo `student_code` hoặc email unique.
7. Worker ghi `csv_import_rows` cho từng dòng thành công/lỗi.
8. Worker cập nhật job status DONE, DONE_WITH_ERRORS hoặc FAILED.
9. Admin xem kết quả import trong dashboard hoặc nhận notification.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| File không tồn tại | Job FAILED, ghi error file-level. |
| CSV sai header | Job FAILED, không import dòng nào. |
| Dòng thiếu student_code/email | Dòng FAILED, các dòng khác tiếp tục. |
| Dữ liệu trùng trong file | Log duplicate row, dùng dòng đầu hoặc rule deterministic. |
| Dữ liệu trùng với database | Upsert theo student_code/email, không tạo duplicate. |
| Database lỗi giữa batch | Rollback batch đó, job FAILED hoặc DONE_WITH_ERRORS tùy policy. |
| Import chạy lại cùng file | Dựa vào `file_hash + import_type` để no-op hoặc tạo rerun có kiểm soát. |
| File có dữ liệu xấu | Không xóa dữ liệu cũ hàng loạt; chỉ update field được phép. |

## Ràng buộc

- Import phải chạy async bằng worker, không chặn API chính.
- File lỗi không làm gián đoạn xem workshop, đăng ký hoặc check-in.
- Phải có import job log và row-level log.
- Upsert phải idempotent.
- Unique constraint trên `student_code` và email để tránh duplicate.
- Không tự động xóa sinh viên không có trong CSV nếu chưa có policy rõ.

## Tiêu chí chấp nhận

- [ ] Given CSV hợp lệ, When import chạy, Then students được insert/update.
- [ ] Given CSV thiếu header bắt buộc, When import chạy, Then job FAILED và không ghi dữ liệu target.
- [ ] Given một số dòng lỗi, When import chạy, Then dòng hợp lệ vẫn được import và job DONE_WITH_ERRORS.
- [ ] Given student_code đã tồn tại, When import dòng mới, Then record được update thay vì tạo duplicate.
- [ ] Given chạy lại cùng file, When worker xử lý, Then không tạo dữ liệu trùng.
- [ ] Given import đang lỗi, When sinh viên xem workshop, Then chức năng xem workshop vẫn hoạt động.
