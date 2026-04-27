# UniHub Workshop — Implementation Tasks

## Phase 1 — Foundation

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 1.1 Project structure | Thiết lập cấu trúc monorepo hoặc multi-app repo gồm backend, student web, admin web, check-in mobile và shared docs. | `/apps/backend`, `/apps/student-web`, `/apps/admin-web`, `/apps/checkin-mobile`, `/packages/shared` | Repo có cấu trúc rõ, README mô tả cách chạy từng app ở mức dev. |
| 1.2 Backend API bootstrap | Tạo Backend API với health check, config loader, error handler chuẩn và request logging. | `backend/src/main`, `backend/src/common` | `GET /health` trả OK; lỗi API trả format thống nhất. |
| 1.3 Database connection | Thiết lập PostgreSQL connection và migration tool. | `backend/src/database`, `migrations/` | Backend kết nối PostgreSQL; migration chạy được ở môi trường dev. |
| 1.4 Core schema migration | Tạo schema ban đầu cho users, roles, permissions, user_roles, students, audit_logs. | `migrations/*core*` | Các bảng auth/RBAC/audit tồn tại với PK, FK, unique, index cơ bản. |
| 1.5 Auth foundation | Thiết lập đăng nhập, JWT/session, middleware xác thực request. | `backend/src/auth` | Request có token hợp lệ được nhận diện user; token sai bị 401. |
| 1.6 RBAC guard | Thiết lập guard kiểm tra role STUDENT, ORGANIZER, CHECKIN_STAFF, ADMIN. | `backend/src/rbac`, `backend/src/common/guards` | Endpoint mẫu chặn user sai quyền bằng 403. |
| 1.7 Audit log service | Ghi audit log cho thao tác quan trọng. | `backend/src/audit` | Tạo/sửa/hủy workshop và thay đổi role có audit log. |

## Phase 2 — Workshop & Registration

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 2.1 Workshop schema | Tạo bảng rooms, speakers, workshops, workshop_speakers, uploaded_files. | `migrations/*workshop*` | Schema có FK, unique slug, index room/time/status. |
| 2.2 Room management | API quản lý phòng, capacity, sơ đồ phòng. | `backend/src/rooms` | Organizer/Admin tạo/sửa/xem phòng; student chỉ đọc thông tin cần thiết. |
| 2.3 Workshop CRUD | API tạo, sửa, đổi phòng/giờ, hủy workshop. | `backend/src/workshops` | Validate `start_time < end_time`, room conflict, capacity hợp lệ; ghi audit. |
| 2.4 Student workshop list | API danh sách workshop với filter ngày, phòng, category, còn chỗ. | `backend/src/workshops`, `student-web/src/workshops` | Student xem danh sách và trạng thái còn chỗ gần realtime. |
| 2.5 Workshop detail | API chi tiết workshop gồm diễn giả, phòng, sơ đồ phòng, giá, AI summary status. | `backend/src/workshops` | Student xem đủ dữ liệu chi tiết; workshop hủy không cho đăng ký. |
| 2.6 Registration schema | Tạo bảng registrations, qr_tokens. | `migrations/*registration*` | Có unique `user_id + workshop_id`, `idempotency_key`, `qr token_hash`. |
| 2.7 Free registration | API đăng ký workshop miễn phí. | `backend/src/registrations` | Sinh viên đăng ký thành công nhận registration CONFIRMED và QR ACTIVE. |
| 2.8 Seat capacity transaction | Implement atomic update chống overbooking. | `backend/src/registrations/seat.service` | Test concurrency cho workshop 60 chỗ không vượt quá 60 registration CONFIRMED. |
| 2.9 Realtime seat update | Publish/update số chỗ còn lại qua cache và WebSocket/SSE hoặc polling endpoint. | `backend/src/realtime`, `backend/src/workshops` | Sau đăng ký/hủy, student thấy số chỗ cập nhật gần realtime. |

## Phase 3 — Payment

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 3.1 Payment schema | Tạo bảng payments và payment_callbacks. | `migrations/*payment*` | Có unique `idempotency_key`, `provider_transaction_id`, index status. |
| 3.2 Payment intent | API tạo payment intent cho workshop có phí. | `backend/src/payments` | Tạo registration PENDING_PAYMENT và payment PENDING; trả payment URL mock/sandbox. |
| 3.3 Idempotency key | Implement idempotency cho payment attempt. | `backend/src/payments/idempotency.service` | Retry cùng key không tạo payment mới, trả kết quả cũ. |
| 3.4 Payment webhook mock | Endpoint nhận webhook mock/sandbox, verify signature giả lập. | `backend/src/payments/webhook.controller` | Webhook success cập nhật PAID, CONFIRMED, tạo QR; duplicate webhook no-op. |
| 3.5 Payment timeout handling | Xử lý payment PENDING quá lâu và status polling. | `backend/src/payments/reconciliation.worker` | Payment timeout chuyển EXPIRED/NEEDS_REVIEW theo rule; không treo request. |
| 3.6 Circuit breaker | Bọc Payment Gateway client bằng circuit breaker. | `backend/src/payments/payment-gateway.client` | Khi gateway lỗi liên tiếp, paid registration trả lỗi tạm thời; xem workshop vẫn OK. |
| 3.7 Refund/reversal placeholder | Tạo cơ chế đánh dấu refund required khi workshop hủy hoặc paid nhưng không confirm seat. | `backend/src/payments/refund.worker` | Có trạng thái REFUND_PENDING/REFUNDED hoặc NEEDS_MANUAL_REVIEW. |

## Phase 4 — Check-in

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 4.1 QR generation | Sinh QR token sau registration CONFIRMED. | `backend/src/qr` | QR token không chứa dữ liệu nhạy cảm; token unique và có expiry. |
| 4.2 QR validation | API validate QR token cho staff. | `backend/src/checkins` | QR không tồn tại, hết hạn, hủy, đã dùng trả lỗi rõ. |
| 4.3 Check-in schema | Tạo bảng checkins và offline_checkin_sync_logs. | `migrations/*checkin*` | Unique `qr_token_id` trong checkins; unique `device_id + local_id` trong sync logs. |
| 4.4 Online check-in | API check-in online. | `backend/src/checkins` | Staff scan QR hợp lệ tạo checkin; scan lại trả already checked-in. |
| 4.5 Mobile scan UI | Màn hình mobile quét QR và hiển thị kết quả. | `checkin-mobile/src/scan` | Staff chọn workshop, scan QR, thấy success/failure. |
| 4.6 Offline local queue | Mobile lưu check-in local khi mất mạng. | `checkin-mobile/src/offline` | Offline event có local_id, qr_token, workshop_id, checked_in_at, staff_id, PENDING_SYNC. |
| 4.7 Batch sync | API batch sync offline check-in. | `backend/src/checkins/sync`, `checkin-mobile/src/sync` | Sync trả kết quả từng local_id: SYNCED, CONFLICT, FAILED. |
| 4.8 Conflict handling | Xử lý QR trùng, QR sai workshop, workshop hủy, stale cache. | `backend/src/checkins/conflict.service` | Conflict được ghi log, không tạo checkin sai. |

## Phase 5 — Notification

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 5.1 Notification schema | Tạo bảng notifications, notification_preferences, notification_deliveries. | `migrations/*notification*` | Có status, retry_count, dedupe_key, index user/status. |
| 5.2 Message broker integration | Thiết lập publish/consume event cơ bản. | `backend/src/events`, `worker/src/events` | API publish `registration.confirmed`; worker consume được. |
| 5.3 Notification abstraction | Tạo interface channel cho Email, App, future Telegram. | `worker/src/notifications/channels` | Thêm channel mới không sửa core orchestration. |
| 5.4 Email provider | Gửi email xác nhận đăng ký qua mock/sandbox. | `worker/src/notifications/email` | Email job SENT/FAILED được log. |
| 5.5 App notification | Lưu notification in-app cho student. | `worker/src/notifications/in-app`, `student-web/src/notifications` | Student xem lịch sử notification của mình. |
| 5.6 Retry policy | Retry notification fail với backoff và max attempts. | `worker/src/notifications/retry` | Provider fail không làm registration fail; job retry và cuối cùng marked FAILED. |

## Phase 6 — AI Summary

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 6.1 PDF upload | Admin upload PDF giới thiệu workshop. | `backend/src/files`, `admin-web/src/workshops` | File PDF được validate type/size và lưu vào Object Storage/local storage. |
| 6.2 AI summary schema | Tạo bảng uploaded_files và ai_summaries. | `migrations/*ai-summary*` | Summary có status PENDING/PROCESSING/DONE/FAILED. |
| 6.3 Text extraction | Worker extract text từ PDF. | `worker/src/ai-summary/extract` | File PDF hợp lệ tạo extracted text; file lỗi marked FAILED. |
| 6.4 Clean text | Làm sạch text, bỏ header/footer/ký tự rác, giới hạn length. | `worker/src/ai-summary/clean` | Text gửi AI không vượt giới hạn và giữ nội dung chính. |
| 6.5 AI service call | Gửi text sang AI service/mock để tạo summary. | `worker/src/ai-summary/ai-client` | Timeout/retry có kiểm soát; lỗi AI không ảnh hưởng trang workshop. |
| 6.6 Save summary | Lưu summary và hiển thị ở detail workshop. | `worker/src/ai-summary`, `student-web/src/workshops` | Khi DONE, detail workshop hiển thị summary; khi FAILED, hiển thị mô tả gốc. |

## Phase 7 — Student CSV Import

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 7.1 Import schema | Tạo bảng csv_import_jobs và csv_import_rows. | `migrations/*student-import*` | Job lưu status, file_hash, totals; row log lưu lỗi từng dòng. |
| 7.2 CSV parser | Worker đọc CSV export ban đêm từ Object Storage/thư mục import. | `worker/src/student-import/parser` | Đọc được file UTF-8, header hợp lệ; file lỗi marked FAILED. |
| 7.3 Schema validation | Validate cột bắt buộc: student_code, email, full_name, major/class nếu có. | `worker/src/student-import/validator` | Dòng thiếu/sai format được log, không crash job. |
| 7.4 Upsert student | Upsert students theo student_code/email. | `worker/src/student-import/upsert` | Dữ liệu trùng update deterministic, không tạo duplicate. |
| 7.5 Import job status | Cập nhật status PENDING/RUNNING/DONE/DONE_WITH_ERRORS/FAILED. | `worker/src/student-import/job.service` | Admin xem được tổng rows, success, failed. |
| 7.6 Error report | Gửi báo cáo import cho admin qua notification. | `worker/src/student-import/report` | Admin nhận report hoặc xem trong dashboard. |

## Phase 8 — Protection & Observability

| Task | Mô tả | File/module dự kiến | Tiêu chí hoàn thành |
| --- | --- | --- | --- |
| 8.1 Rate limiting | Implement Redis rate limiting theo user/IP/endpoint. | `backend/src/rate-limit` | Vượt ngưỡng trả 429; endpoint đăng ký có policy riêng. |
| 8.2 Registration fairness | Thêm idempotency và optional waiting-room nhẹ cho đợt mở đăng ký. | `backend/src/registrations/fairness` | Spam click không tạo duplicate và không bypass rate limit. |
| 8.3 Error logs | Chuẩn hóa structured logging cho API/worker. | `backend/src/logging`, `worker/src/logging` | Log có request_id, user_id nếu có, endpoint/job type. |
| 8.4 Audit logs | Ghi audit cho admin action, payment webhook, CSV import, check-in override. | `backend/src/audit` | Admin xem được thao tác quan trọng theo thời gian. |
| 8.5 Admin statistics | Dashboard số đăng ký, check-in, no-show, revenue, import status. | `backend/src/admin`, `admin-web/src/dashboard` | Organizer/Admin xem thống kê theo workshop/ngày/phòng. |
| 8.6 Health checks | Health check cho PostgreSQL, Redis, Broker, Payment Gateway circuit state. | `backend/src/health` | Admin/dev biết thành phần nào degraded. |
| 8.7 Load test plan | Tài liệu kịch bản load 12.000 users/10 phút và registration spike. | `docs/load-test-plan.md` hoặc `blueprint/performance-notes.md` | Có tiêu chí đo p95 latency, error rate, 429 rate, registration correctness. |
