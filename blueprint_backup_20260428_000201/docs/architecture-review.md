# UniHub Workshop - Architecture Review

## 4.1 Tóm tắt phạm vi kiểm tra

File này so sánh yêu cầu chức năng trong `docs/feature.md` với kiến trúc hiện tại trong `docs/architecture.md`.

Mục tiêu kiểm tra:

- Xác định `architecture.md` đã bao phủ các chức năng chính trong `feature.md` hay chưa.
- Ghi nhận các điểm thiếu, chưa nhất quán hoặc cần làm rõ.
- Đề xuất hướng cập nhật `architecture.md` mà không sửa trực tiếp file gốc trong lần review này.

Nhận xét tổng quan: `architecture.md` hiện tại đã bao phủ phần lớn yêu cầu cốt lõi của `feature.md`, đặc biệt là registration, payment, QR, check-in online/offline, notification, AI summary từ PDF, Redis cache/lock và message broker. Các khoảng thiếu chính là CSV import ban đêm, AI Recommendation đúng nghĩa và một số chi tiết schema/ràng buộc cần chỉnh để tránh hiểu sai khi triển khai.

## 4.2 Checklist đối chiếu

| Nhóm chức năng                            | Yêu cầu trong `feature.md`                                                                                                                   | Đã có trong `architecture.md` chưa? | Nhận xét                                                                                                                                | Đề xuất sửa                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sinh viên xem workshop                    | F1 yêu cầu xem danh sách, lọc, tìm kiếm, số chỗ realtime.                                                                                    | Có                                  | Có Student App, Workshop Service, Redis seat cache, Realtime Seat Service, search index optional.                                       | Giữ thiết kế hiện tại; làm rõ search index là optional cho MVP.                                                                                        |
| Xem chi tiết workshop                     | F2 yêu cầu chi tiết diễn giả, phòng, sơ đồ phòng, giá, AI summary, số chỗ realtime.                                                          | Có                                  | Có Workshop Service, rooms, speakers, Object Storage cho layout/PDF, AI Summary.                                                        | Bổ sung rõ API trả summary status PENDING/DONE/ERROR.                                                                                                  |
| Đăng ký workshop miễn phí                 | F3 yêu cầu kiểm tra capacity, chống đăng ký trùng, tạo QR ngay, gửi notification.                                                            | Có                                  | Có Registration Service, Redis lock/seat counter, QR Service, Notification Service.                                                     | Làm rõ transaction boundary: DB vẫn là source of truth, Redis chỉ hỗ trợ lock/counter.                                                                 |
| Đăng ký workshop có phí                   | F4 yêu cầu qua Payment Gateway, chỉ xác nhận từ webhook, idempotency, reconciliation.                                                        | Có                                  | Có Payment Service, callback, webhook verification, reconciliation/refund worker.                                                       | Làm rõ registration PENDING_PAYMENT và chỉ tạo QR sau payment PAID.                                                                                    |
| Nhận QR sau đăng ký                       | F3/F4/F5 yêu cầu QR unique, xem/download/in QR, QR có expiry/used status.                                                                    | Có                                  | Có QR Code Service và bảng tickets.                                                                                                     | Đổi tên bảng/thuật ngữ từ `tickets` sang `qr_tickets` hoặc giải thích ticket chính là QR ticket để tránh mơ hồ.                                        |
| Notification qua app/email                | F6 yêu cầu email, push, SMS, Telegram, preference, retry.                                                                                    | Có                                  | Có Notification Service, channels, preferences, deliveries, SMS/chat provider.                                                          | Bổ sung rõ in-app notification nếu Student App cần xem lịch sử thông báo.                                                                              |
| Admin tạo/cập nhật/hủy workshop           | F7/F8/F9 yêu cầu tạo, sửa phòng/giờ, hủy, upload PDF, thông báo sinh viên, refund nếu có phí.                                                | Có                                  | Có Workshop Service, AI Summary Worker, cancel/refund flow, notification event.                                                         | Làm rõ policy khi đổi capacity nhỏ hơn số đăng ký hiện tại.                                                                                            |
| Admin xem thống kê                        | F10 yêu cầu dashboard đăng ký, check-in, show-up, revenue, export.                                                                           | Có                                  | Có Reporting/Analytics Service, reporting snapshots, export CSV/Excel.                                                                  | Bổ sung độ trễ dữ liệu dashboard nếu dùng batch/materialized view.                                                                                     |
| Check-in bằng QR                          | F11 yêu cầu scan QR, validate token, chống scan trùng, update check-in.                                                                      | Có                                  | Có Check-in Service, Redis lock, checkins table.                                                                                        | Sửa unique constraint: nên unique theo `qr_ticket_id`, không phải (`ticket_id`, `checkin_time`).                                                       |
| Check-in offline                          | F12 yêu cầu app local DB, scan offline, lưu PENDING, validate cơ bản.                                                                        | Có                                  | Có Check-in Mobile App local SQLite và offline_checkin_events.                                                                          | Bổ sung preload danh sách QR/registration hợp lệ trước sự kiện để offline validation tốt hơn.                                                          |
| Đồng bộ check-in khi có mạng              | F12 yêu cầu batch sync, conflict detection, partial sync.                                                                                    | Có                                  | Có Check-in Sync Service, conflict log, offline sync status.                                                                            | Làm rõ API trả kết quả từng dòng theo `local_checkin_id`.                                                                                              |
| AI recommendation                         | `feature.md` chủ yếu yêu cầu AI Summary từ PDF, chưa mô tả AI Recommendation rõ ràng. Yêu cầu hiện tại của đề bài có thêm AI Recommendation. | Chưa đủ                             | `architecture.md` có AI Summary Worker/LLM Summary Service, không có AI Recommendation Service, user interest hoặc bảng recommendation. | Nếu scope mới cần recommendation, thêm AI Recommendation Service, `user_interests`, `ai_recommendations`, cache recommendation và fallback khi AI lỗi. |
| Import CSV ban đêm                        | Không thấy mô tả rõ trong `feature.md`; yêu cầu hiện tại của đề bài yêu cầu luồng CSV import ban đêm.                                        | Chưa có                             | `architecture.md` có report export CSV/Excel nhưng chưa có CSV Import Service, import job/log, scheduler import.                        | Thêm CSV Import Service, `csv_import_jobs`, `csv_import_logs`, Object Storage input, nightly scheduler và validation/batch transaction.                |
| Tích hợp hệ thống cũ                      | `feature.md` nhắc hệ thống authentication/LDAP và profile sinh viên.                                                                         | Có                                  | Có School Auth/LDAP và Legacy Student System.                                                                                           | Làm rõ fallback khi legacy down và dữ liệu profile cache hết hạn.                                                                                      |
| Tích hợp payment gateway                  | F4/F9/payment NFR yêu cầu charge, webhook, refund, reconciliation.                                                                           | Có                                  | Có Payment Gateway, Payment Service, Refund & Reconciliation Worker.                                                                    | Bổ sung lưu raw webhook payload/hash để audit và chống replay.                                                                                         |
| Mở rộng notification channel như Telegram | F6/F7.5 yêu cầu dễ thêm SMS/Telegram/WhatsApp.                                                                                               | Có                                  | Có SMS/Chat Provider, channel abstraction, notification_channels.                                                                       | Giữ thiết kế; bổ sung interface adapter rõ hơn nếu viết component design.                                                                              |

## 4.3 Các điểm thiếu hoặc chưa nhất quán

### 4.3.1 Payment Gateway

**Trạng thái:** Đã có.

`architecture.md` đã có Payment Gateway ở C4 Level 1/2, Payment Service, webhook flow, refund và reconciliation. Điểm cần làm rõ là trạng thái PAID chỉ được cập nhật từ webhook/callback đã verify hoặc reconciliation đã xác minh, không từ redirect của browser.

### 4.3.2 QR Ticket Service

**Trạng thái:** Đã có nhưng nên chuẩn hóa thuật ngữ.

File hiện tại dùng QR Code Service và bảng `tickets`. Về nghiệp vụ, nên gọi rõ là QR Ticket hoặc `qr_tickets` vì ticket này gắn một-một với registration và dùng cho check-in.

Điểm cần sửa trong schema: ràng buộc check-in hiện tại mô tả unique (`ticket_id`, `checkin_time`) có thể vẫn cho phép cùng QR check-in nhiều lần ở các thời điểm khác nhau. Nên unique trực tiếp trên `qr_ticket_id` trong `checkin_records`.

### 4.3.3 Offline Sync Service

**Trạng thái:** Đã có.

`architecture.md` có Check-in Sync Service, local SQLite, offline_checkin_events, conflict handling. Cần bổ sung rõ hơn:

- App nên preload danh sách registration/QR hợp lệ theo workshop trước sự kiện.
- Batch sync response cần trả kết quả từng dòng theo `local_checkin_id`.
- Server cần unique idempotency key cho từng offline check-in.

### 4.3.4 Local database trên mobile

**Trạng thái:** Đã có.

Diagram hiện tại đã có Local Storage SQLite. Nên mô tả thêm bảng local tối thiểu:

- `preloaded_qr_cache`.
- `pending_checkins`.
- `sync_results`.

### 4.3.5 Message Broker

**Trạng thái:** Đã có.

`architecture.md` đã dùng RabbitMQ cho registration, payment, refund, notification, check-in, PDF summary. Nên thêm event cho CSV import nếu bổ sung scope:

- `csv.import.requested`.
- `csv.import.completed`.
- `csv.import.failed`.

### 4.3.6 Notification Service

**Trạng thái:** Đã có.

Thiết kế hiện tại đã có service, channels, templates, preferences và delivery. Nên bổ sung `IN_APP` channel hoặc notification inbox nếu muốn Student App xem lại lịch sử thông báo trong app.

### 4.3.7 AI Recommendation Service

**Trạng thái:** Chưa có đúng nghĩa theo yêu cầu hiện tại.

`feature.md` yêu cầu AI Summary từ PDF, không mô tả rõ AI Recommendation. `architecture.md` đang bám đúng `feature.md` ở phần AI Summary. Tuy nhiên, yêu cầu hiện tại của đề bài có “AI Recommendation Service”, “AI Model/API” và “AI Recommendation / User Interest”, nên nếu scope mới được chấp nhận thì cần bổ sung:

- AI Recommendation Service.
- Bảng `user_interests`.
- Bảng `ai_recommendations`.
- Logic lấy dữ liệu ngành học, tag workshop, lịch sử đăng ký/check-in.
- Fallback khi AI lỗi: trả danh sách popular/recent workshops.

### 4.3.8 CSV Import Service

**Trạng thái:** Thiếu.

`feature.md` không có mục CSV import rõ ràng, nhưng đề bài hiện tại yêu cầu luồng nhập CSV ban đêm. `architecture.md` hiện chỉ có report export CSV/Excel, không có import job.

Cần bổ sung:

- CSV Import Service.
- Nightly Scheduler.
- Object Storage input cho file CSV.
- `csv_import_jobs`, `csv_import_logs`.
- Validate format và nghiệp vụ.
- Batch transaction và idempotency theo `file_hash`/business key.
- Notification báo cáo import cho admin.

### 4.3.9 Idempotency handling

**Trạng thái:** Có nhưng cần chuẩn hóa ở từng luồng.

`architecture.md` có idempotency cho registration, payment và check-in. Cần thống nhất tên key và nơi lưu:

- Registration: `registrations.idempotency_key`.
- Payment: `payments.idempotency_key`, `provider_order_id`, `provider_transaction_id`.
- Payment webhook: `payment_callbacks` kèm raw payload hash.
- Check-in online/offline: `checkin_records.idempotency_key`, `offline_checkin_sync_logs.idempotency_key`.
- CSV import: `csv_import_jobs.file_hash` và business key từng dòng.

### 4.3.10 Conflict handling khi sync offline

**Trạng thái:** Có nhưng nên chi tiết hơn.

Hiện có conflict lock/log nhưng nên liệt kê các conflict reason chuẩn:

- `QR_NOT_FOUND`.
- `QR_ALREADY_USED`.
- `REGISTRATION_CANCELLED`.
- `WORKSHOP_CANCELLED`.
- `WRONG_WORKSHOP`.
- `STALE_CACHE`.
- `DUPLICATE_IDEMPOTENCY_KEY`.

### 4.3.11 Cache số chỗ còn lại

**Trạng thái:** Có.

Thiết kế dùng Redis seat counter. Cần nhấn mạnh PostgreSQL vẫn là source of truth. Redis counter cần resync định kỳ từ số registration CONFIRMED để tránh lệch sau lỗi rollback/retry.

### 4.3.12 Database schema phù hợp

**Trạng thái:** Phần lớn phù hợp, cần chỉnh vài điểm.

Điểm tốt:

- Có users/roles/students.
- Có workshops, rooms, speakers.
- Có registrations/tickets/payments/callbacks/refunds.
- Có checkins/offline events.
- Có notification preferences/templates/deliveries.
- Có workshop_files/ai_summaries.
- Có reporting/audit logs.

Điểm cần chỉnh:

- PostgreSQL không cho CHECK constraint dùng subquery như đoạn `chk_registration_before_session` trong schema mẫu. Rule này nên xử lý bằng application validation hoặc trigger.
- Unique check-in nên là `qr_ticket_id`, không phải (`ticket_id`, `checkin_time`).
- Nếu bài yêu cầu schema đơn giản, có thể bỏ `workshop_sessions` và đưa `start_time`, `end_time`, `room_id`, `capacity`, `price` trực tiếp vào `workshops`. Nếu giữ `workshop_sessions`, cần giải thích vì sao một workshop có thể có nhiều phiên.
- Thiếu bảng CSV import.
- Thiếu bảng AI recommendation/user interest nếu scope mới cần recommendation.

## 4.4 Đề xuất cập nhật `architecture.md`

### 4.4.1 Bổ sung CSV Import vào Container Diagram

Thêm container trong Business Service Layer:

```text
CSV Import Service (Node.js)
- Đọc file CSV từ Object Storage.
- Validate header/format/business rules.
- Insert/update dữ liệu theo batch transaction.
- Ghi csv_import_jobs và csv_import_logs.
- Gửi báo cáo import cho admin qua Notification Service.
```

Thêm container hoặc component trong Integration & Async Layer:

```text
Nightly Scheduler / Job Queue
- Chạy ban đêm.
- Publish csv.import.requested(job_id).
- Hỗ trợ retry job an toàn.
```

Thêm quan hệ:

```text
Admin Web -> Backend API -> CSV Import Service
CSV Import Service -> Object Storage: read CSV
CSV Import Service -> PostgreSQL: write import job/log and target data
CSV Import Service -> Message Broker: publish csv.import.completed/failed
Notification Service -> Admin: send import report
```

### 4.4.2 Bổ sung schema CSV import

Thêm hai bảng:

```text
csv_import_jobs
- id
- import_type
- file_url
- file_hash
- status
- total_rows
- success_rows
- failed_rows
- created_by
- started_at
- finished_at
- created_at

csv_import_logs
- id
- job_id
- row_number
- business_key
- status
- error_code
- error_message
- raw_row
- created_at
```

Ràng buộc đề xuất:

- Unique (`import_type`, `file_hash`) nếu không cho import cùng file nhiều lần.
- Unique (`job_id`, `row_number`) để log từng dòng không trùng.
- Upsert target data theo business key, không theo row number.

### 4.4.3 Bổ sung AI Recommendation nếu scope mới yêu cầu

Vì `feature.md` hiện yêu cầu AI Summary, còn đề bài hiện tại yêu cầu AI Recommendation, nên nên tách rõ hai phần:

```text
AI Summary Worker
- Xử lý PDF -> summary.
- Bám sát F13 trong feature.md.

AI Recommendation Service
- Gợi ý workshop cho sinh viên.
- Đọc user profile, user interests, registrations, check-ins, workshop tags.
- Gọi AI Model/API hoặc rule-based scoring.
- Không ảnh hưởng trực tiếp đến đăng ký/thanh toán.
```

Thêm bảng:

```text
user_interests
- id
- user_id
- interest_key
- weight
- source
- updated_at

ai_recommendations
- id
- user_id
- workshop_id
- score
- reason
- model_name
- generated_at
- expires_at
```

Fallback khi AI lỗi:

- Trả workshop phổ biến theo ngành/tag.
- Trả danh sách workshop mới nhất hoặc gần diễn ra.
- Ghi log lỗi AI nhưng không làm lỗi trang danh sách workshop.

### 4.4.4 Chuẩn hóa QR/check-in constraint

Đề xuất sửa schema check-in:

```text
checkin_records
- id
- qr_ticket_id unique
- workshop_id
- checked_in_by
- checked_in_at
- source
- sync_status
- idempotency_key unique
- device_id
```

Rule:

- `qr_tickets.status` chuyển ACTIVE -> USED trong cùng transaction khi insert `checkin_records`.
- Nếu insert fail vì unique `qr_ticket_id`, trả ALREADY_CHECKED_IN.
- Offline sync conflict phải ghi `offline_checkin_sync_logs`.

### 4.4.5 Làm rõ payment state machine

Đề xuất ghi rõ trạng thái:

```text
Registration:
PENDING_PAYMENT -> CONFIRMED -> CANCELLED
PENDING_PAYMENT -> EXPIRED

Payment:
PENDING -> PAID
PENDING -> FAILED
PAID -> REFUNDED
```

Rule:

- Không tạo QR khi payment chưa PAID.
- Không tin browser redirect.
- Webhook duplicate không tạo side effect mới.
- Nếu PAID nhưng confirm registration/QR lỗi, tạo recovery job và báo admin.

### 4.4.6 Làm rõ nguồn dữ liệu seat availability

Đề xuất ghi:

- PostgreSQL là source of truth.
- Redis giữ counter/cache để đọc nhanh và lock.
- Khi registration CONFIRMED/CANCELLED/REFUNDED, publish `seat.updated`.
- Có job resync Redis seat count từ PostgreSQL theo chu kỳ hoặc khi phát hiện lệch.

### 4.4.7 Cập nhật phần Technology Stack

Sau yêu cầu trước đó, stack backend nên thống nhất là Node.js:

```text
Backend API: Node.js
Business modules: Node.js
AI Summary Worker: Python FastAPI/Celery hoặc Node.js worker nếu muốn đơn giản hóa
Database: PostgreSQL
Cache: Redis
Message Broker/Job Queue: RabbitMQ
Mobile: Flutter hoặc React Native
Frontend: React/Next.js
```

### 4.4.8 Đề xuất ưu tiên triển khai MVP

Để phù hợp bài môn Thiết kế phần mềm và dễ triển khai cho sinh viên, nên chia giai đoạn:

| Giai đoạn | Nội dung                                                                                 |
| --------- | ---------------------------------------------------------------------------------------- |
| MVP 1     | Auth, workshop CRUD, danh sách/chi tiết workshop, đăng ký miễn phí, QR, check-in online. |
| MVP 2     | Payment Gateway, payment webhook, workshop có phí, notification email/push.              |
| MVP 3     | Offline check-in sync, conflict handling, dashboard.                                     |
| MVP 4     | AI Summary từ PDF, CSV import ban đêm.                                                   |
| Mở rộng   | AI Recommendation, Telegram/SMS, advanced search, reconciliation dashboard.              |

## Kết luận review

`architecture.md` hiện tại đủ tốt làm nền tảng kiến trúc cho hầu hết yêu cầu trong `feature.md`. Các điểm cần cập nhật quan trọng nhất là:

1. Thêm CSV Import Service và schema import job/log nếu yêu cầu CSV import ban đêm là bắt buộc.
2. Tách AI Summary và AI Recommendation để tránh nhầm phạm vi.
3. Sửa ràng buộc check-in để bảo đảm một QR chỉ check-in thành công một lần.
4. Chuẩn hóa payment/registration state machine và idempotency key.
5. Làm rõ PostgreSQL là source of truth, Redis chỉ là cache/lock/counter hỗ trợ realtime.
