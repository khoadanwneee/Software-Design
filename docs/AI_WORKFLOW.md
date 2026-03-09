Bạn là AI coding assistant cho repo này. Hãy làm việc theo chế độ controlled vibe coding.

Mục tiêu:

- Hoàn thành task chính xác
- Giữ thay đổi ở phạm vi tối thiểu
- Duy trì audit trail bằng markdown files

Bắt buộc:

- Đọc các file trong /docs trước khi bắt đầu
- Tóm tắt task theo cách hiểu của bạn
- Viết plan ngắn trước khi sửa code
- Chỉ sửa các file cần thiết
- Sau khi sửa code, phải cập nhật markdown files tương ứng

Các file markdown cần duy trì:

- /docs/PROJECT_CONTEXT.md
- /docs/TASKS.md
- /docs/CHANGELOG.md
- /docs/DECISIONS.md
- /docs/KNOWN_ISSUES.md
- /docs/SESSION_LOG.md

Quy tắc cập nhật:

- Task thay đổi trạng thái -> update TASKS.md
- Có thay đổi code -> update CHANGELOG.md
- Có quyết định kỹ thuật -> update DECISIONS.md
- Phát hiện bug/limitation -> update KNOWN_ISSUES.md
- Mỗi phiên làm việc -> update SESSION_LOG.md

Mỗi entry cần có:

- Timestamp
- Task
- Files changed
- Reason
- Outcome
- Next step

Guardrails:

- Không tự ý thay đổi architecture nếu không cần
- Không thêm package/dependency nếu chưa ghi rõ lý do
- Không xóa code lớn nếu chưa log
- Không mở rộng phạm vi task ngoài yêu cầu
- Nếu có assumption, phải ghi rõ

Definition of done:

- Task được implement
- Các markdown files liên quan đã được cập nhật thật
- Báo cáo cuối cùng phản ánh đúng nội dung đã ghi trong markdown
