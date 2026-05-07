# UniHub Workshop - Undone / Remaining Work

Updated: 2026-05-07

File này theo dõi các hạng mục chưa hoàn chỉnh so với blueprint/design hiện tại. Các chức năng đã được hoàn thành gần đây được giữ ở đầu file để dễ đối chiếu với danh sách cũ.

## Đã Hoàn Thành Gần Đây

| Nhóm chức năng | Trạng thái hiện tại | Endpoint/UI kiểm tra | Ghi chú |
| --- | --- | --- | --- |
| Realtime seat availability | Hoàn thành mức MVP | `GET /api/workshops/:id/seats`, `GET /api/workshops/:id/seats/stream`, UI `/workshops`, `/workshops/:id` | Dùng SSE qua Redis pub/sub + Redis cache TTL ngắn; frontend có polling fallback. PostgreSQL vẫn là source of truth. |
| Search/filter workshop UI | Hoàn thành mức MVP | `GET /api/workshops?keyword=&category=&roomId=&fromDate=&toDate=&hasSeats=&priceType=&page=&limit=`, UI `/workshops` | UI có query params, debounce keyword, clear filters, loading/error/empty states. |
| Room management đầy đủ mức MVP | Hoàn thành mức MVP | `GET/POST /api/rooms`, `GET/PATCH/DELETE /api/rooms/:id`, `PATCH /api/rooms/:id/status`, `POST /api/rooms/:id/layout`, UI `/admin/rooms` | Organizer/Admin quản lý phòng; student chỉ đọc. Delete là soft archive. Layout hiện là metadata/local URL, chưa lưu binary thật. |
| User/role management UI | Hoàn thành mức MVP | `GET /api/users`, `PATCH /api/users/:id/roles`, `PATCH /api/users/:id/status`, UI `/admin/users` | Chỉ ADMIN truy cập. Có filter keyword/role/status, audit log, guard chống khóa/remove ADMIN cuối cùng. |
| Notification in-app UI | Hoàn thành mức MVP | `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, UI `/notifications` | Student xem lịch sử notification của chính mình, lọc ALL/UNREAD/READ, unread badge ở navigation, polling 30s, mark read/mark all read. |
| Offline validation bằng cache | Hoàn thành mức MVP | `GET /api/checkins/offline-cache?workshopId=...`, UI `/checkin`, IndexedDB `qrCache` | Staff preload active QR token hash theo workshop khi online; offline scan validate local cache trước khi lưu queue, mark used locally để chặn scan trùng trên thiết bị; server vẫn validate lại khi `/api/checkins/offline-sync`. |
| Student CSV import đầy đủ | Hoàn thành mức MVP | `POST /api/admin/student-imports`, `GET /api/admin/student-imports`, `GET /api/admin/student-imports/:id`, UI `/admin/student-imports`, local object storage `.unihub-storage` | Admin upload CSV thật qua multipart; lưu file vào `uploaded_files` + local object storage; worker đọc file bằng `storageKey`, parse quoted comma/newline, upsert idempotent, ghi row errors, audit log và notification khi hoàn tất. |
| Redis dev degradation | Hoàn thành mức dev hardening | API startup, queue publish, SSE subscription | Khi Redis chưa chạy, API log gọn và degrade thay vì spam retry/stack trace; Redis vẫn cần chạy cho queue/realtime/rate-limit đầy đủ. |
| API port conflict message | Hoàn thành mức dev hardening | `pnpm --filter @unihub/api dev` | Khi port `API_PORT` bị chiếm, server báo lỗi dễ hiểu thay vì stack trace dài. |

## Còn Lại

| Nhóm chức năng | Trạng thái hiện tại | Công nghệ nên dùng để tối ưu | Lý do / phạm vi còn thiếu |
| --- | --- | --- | --- |
| Audit log phủ đủ nghiệp vụ | Một phần | PostgreSQL `audit_logs`, service audit dùng chung, structured event payload | Đã có audit cho workshop, room, user role/status và student CSV import. Chưa phủ payment webhook, check-in override/conflict handling theo Task 8.4. |
| Paid registration flow UI | Một phần | Payment mock/sandbox redirect, idempotency key, circuit breaker, status polling | Backend tạo `PENDING_PAYMENT` và payment mock URL; UI hiện mới hiển thị text `Payment URL`, chưa có redirect/polling/payment result page. |
| Payment reconciliation/timeout scheduler | Một phần | BullMQ repeatable job hoặc cron worker, PostgreSQL status scan, retry/backoff | Worker có handler `payment.reconcile`, nhưng chưa có scheduler/enqueue định kỳ để tự xử lý payment `PENDING` quá lâu. |
| Refund/reversal | Chưa hoàn thành | Refund worker, payment state machine, gateway mock/sandbox, audit log | Schema đã có trạng thái `REFUND_PENDING`, `REFUNDED`, `NEEDS_MANUAL_REVIEW`, nhưng chưa có API/worker/UI xử lý refund khi workshop bị hủy hoặc payment bất thường. |
| Staff assignment theo workshop/phòng | Chưa hoàn thành | Assignment table, RBAC + ownership check ở service layer, audit log | Hiện mới kiểm tra role `CHECKIN_STAFF`/`ORGANIZER`/`ADMIN`; chưa enforce staff chỉ scan/sync workshop được phân công. |
| Notification preferences/multi-channel | Chưa hoàn thành | `notification_preferences`, `notification_deliveries`, channel registry, template engine, retry/backoff | Email provider còn mock; chưa có preference, template engine, deliveries, hoặc cấu trúc mở rộng channel đầy đủ. |
| AI summary thật từ PDF | Một phần | Object/local storage, multipart upload, PDF parser, text cleaning, AI provider, worker timeout/retry | Hiện mới upload metadata và mock summary; chưa lưu binary PDF thật, chưa extract/clean text, chưa gọi AI service thật. |
| Admin reporting nâng cao | Một phần | Admin dashboard charts, aggregate queries/materialized views nếu cần, import/payment status widgets | Dashboard hiện có số workshop/registration/check-in/revenue cơ bản. Chưa hiển thị no-show, payment circuit/recent imports đầy đủ, audit/import drill-down. |
| Health checks tổng hợp | Một phần | Health endpoint cho PostgreSQL, Redis, Broker/BullMQ, Payment Gateway circuit state | Đã có `/health`, `/health/db`, `/health/redis`. Chưa có health tổng hợp cho broker/BullMQ và payment circuit state. |
| Structured logging / observability | Một phần | Pino/Winston JSON logs, request_id correlation, Prometheus metrics, OpenTelemetry tracing | Có request-id và morgan. Chưa có JSON logs chuẩn, metrics, tracing, alerting hoặc worker job observability đầy đủ. |
| Load test plan | Chưa hoàn thành | k6 hoặc Artillery, scenario 12.000 users/10 phút, registration spike, p95/error/429/correctness metrics | Chưa có `docs/load-test-plan.md` hoặc performance notes theo Task 8.7. |
| Integration tests thật cho luồng quan trọng | Một phần | Vitest integration tests, Testcontainers PostgreSQL/Redis, concurrency test | Có scaffold tests bị skip cho concurrency/idempotency/offline/import. Chưa có test DB lifecycle để chạy tự động trong CI. |
| Frontend tests cho UI mới | Một phần | React Testing Library, mocked api-client/MSW, query param interaction tests | Các page filter workshop, admin rooms, admin users đã có code nhưng chưa có test render/interaction riêng. |

## Ghi Chú Kiểm Tra Nhanh

- Realtime seats cần Redis chạy để SSE/pub-sub hoạt động đầy đủ: `docker compose -f infra/compose.yaml up -d redis`.
- Nếu Redis tắt, API vẫn boot cho dev cơ bản, nhưng realtime sẽ rơi về polling fallback và queue jobs không chạy.
- Các UI chính sau cập nhật:
  - Student workshop/filter: `/workshops`
  - Workshop detail realtime seats: `/workshops/:id`
  - Student notifications: `/notifications`
  - Check-in offline QR cache: `/checkin`
  - Admin student imports: `/admin/student-imports`
  - Admin room management: `/admin/rooms`
  - Admin user/role management: `/admin/users`
