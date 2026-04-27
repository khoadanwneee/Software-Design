# UniHub Workshop — Project Proposal

## Vấn đề

UniHub Workshop là hệ thống phục vụ “Tuần lễ kỹ năng và nghề nghiệp” của Trường Đại học A. Sự kiện kéo dài 5 ngày, mỗi ngày có 8-12 workshop diễn ra song song tại nhiều phòng. Cách vận hành hiện tại bằng Google Form, bảng tính và email thủ công không còn phù hợp với quy mô mới.

Các vấn đề chính:

- **Google Form và email thủ công không còn đáp ứng được quy mô**: dữ liệu phân tán, khó tổng hợp, khó gửi xác nhận kịp thời, dễ sai sót khi workshop đổi phòng/giờ.
- **Không kiểm soát tốt tranh chấp chỗ ngồi**: workshop có thể chỉ có 60 chỗ nhưng hàng trăm sinh viên đăng ký cùng lúc; form thủ công không đảm bảo transaction nên dễ overbooking.
- **Khó xử lý thanh toán**: workshop có phí cần cổng thanh toán, webhook, trạng thái pending/success/fail, retry và đối soát. Nếu xử lý không idempotent có thể trừ tiền hoặc xác nhận đăng ký nhiều lần.
- **Khó check-in offline**: mạng tại cửa phòng có thể yếu hoặc mất kết nối; nếu chỉ dựa vào server online, nhân sự không thể check-in ổn định và có nguy cơ mất dữ liệu.
- **Khó thống kê và quản trị**: ban tổ chức cần số đăng ký, số tham dự, no-show, doanh thu, trạng thái phòng và lịch sử thay đổi gần thời gian thực.
- **Legacy Student System không có API**: hệ thống cũ chỉ export CSV ban đêm; UniHub cần nhập dữ liệu định kỳ để xác thực sinh viên mà không làm gián đoạn hệ thống đang chạy.

## Mục tiêu

Mục tiêu định lượng:

- Hỗ trợ khoảng **12.000 sinh viên truy cập trong 10 phút đầu**, trong đó khoảng 60% có thể dồn vào 3 phút đầu.
- Đảm bảo số đăng ký xác nhận không vượt quá `capacity` của workshop.
- Endpoint đăng ký phải có rate limiting và cơ chế công bằng theo user/IP để tránh một nhóm nhỏ chiếm tài nguyên.
- Mỗi payment attempt có idempotency key; retry cùng key không tạo giao dịch hoặc registration trùng.
- Check-in offline phải lưu cục bộ an toàn và đồng bộ lại được theo batch khi có mạng.
- CSV import hằng đêm phải có import job log, xử lý dòng lỗi riêng và không làm hỏng dữ liệu cũ.

Mục tiêu định tính:

- Sinh viên xem danh sách workshop, chi tiết diễn giả, phòng, sơ đồ phòng và số chỗ còn lại theo thời gian thực hoặc gần thời gian thực.
- Hỗ trợ workshop miễn phí và workshop có phí.
- Sinh viên nhận QR sau khi đăng ký thành công.
- Nhân sự check-in quét QR online/offline, có xử lý trùng lặp và conflict khi sync.
- Ban tổ chức tạo, sửa, đổi phòng, đổi giờ, hủy workshop và xem thống kê.
- Hệ thống xử lý PDF giới thiệu workshop để tạo AI summary.
- Notification qua app và email; thiết kế dễ mở rộng thêm Telegram.
- Khi Payment Gateway hoặc AI Service lỗi, các tính năng không liên quan như xem lịch workshop vẫn hoạt động.

## Người dùng và nhu cầu

### Sinh viên

Sinh viên cần một web/mobile app để:

- Xem danh sách workshop theo ngày, phòng, chủ đề và trạng thái còn chỗ.
- Xem chi tiết workshop gồm diễn giả, mô tả, phòng, sơ đồ phòng, giá vé, AI summary và số chỗ còn lại.
- Đăng ký workshop miễn phí hoặc có phí.
- Thanh toán an toàn, không bị trừ tiền hai lần.
- Nhận QR sau khi đăng ký thành công.
- Nhận thông báo qua app/email khi đăng ký thành công, workshop đổi phòng/giờ hoặc bị hủy.

### Ban tổ chức

Ban tổ chức cần admin web nội bộ để:

- Tạo workshop, cập nhật thông tin, đổi phòng, đổi giờ, thay đổi sức chứa và hủy workshop.
- Upload PDF để hệ thống tạo bản tóm tắt AI.
- Theo dõi số đăng ký, số tham dự, no-show, doanh thu và trạng thái xử lý thanh toán.
- Xem log import sinh viên từ CSV.
- Xem audit log cho thao tác quan trọng.

### Nhân sự check-in

Nhân sự check-in cần mobile app hoặc mobile-first app để:

- Chọn workshop/phòng đang phụ trách.
- Quét QR tại cửa phòng.
- Check-in online nhanh khi có mạng.
- Lưu check-in tạm thời vào local storage khi mất mạng.
- Tự động đồng bộ dữ liệu offline khi mạng khôi phục.
- Nhận phản hồi rõ ràng khi QR đã dùng, QR không hợp lệ hoặc có conflict.

## Phạm vi

### In-scope

- Web app cho sinh viên.
- Admin web cho ban tổ chức.
- Mobile app hoặc mobile-first app cho nhân sự check-in.
- Backend API trung tâm.
- PostgreSQL làm database giao dịch chính.
- Redis cho rate limiting, cache, lock và state ngắn hạn.
- Message Broker hoặc job queue, ưu tiên RabbitMQ hoặc tương đương.
- Object Storage hoặc local object storage cho PDF upload, CSV import file, QR image và sơ đồ phòng.
- Payment integration dạng mock hoặc sandbox.
- AI summary integration từ PDF.
- CSV import từ file export ban đêm của Legacy Student System.
- Notification qua app/email với thiết kế mở rộng sang Telegram.
- RBAC cho STUDENT, ORGANIZER, CHECKIN_STAFF, ADMIN.
- Audit log và thống kê admin cơ bản.

### Out-of-scope

- Không cần Payment Gateway production thật.
- Không cần lưu hoặc xử lý dữ liệu thẻ thanh toán trực tiếp.
- Không cần hạ tầng cloud production đầy đủ như autoscaling multi-region, CDN production hoặc observability enterprise.
- Không cần tích hợp API thật với hệ thống cũ vì hệ thống cũ chỉ có CSV export.
- Không cần tự huấn luyện AI model; chỉ tích hợp AI Service/API hoặc mock AI Service.
- Không cần triển khai Telegram production trong phiên bản đầu; chỉ cần thiết kế mở rộng.
- Không cần waitlist phức tạp hoặc seat allocation theo thuật toán nâng cao.

## Rủi ro và ràng buộc

| Rủi ro / ràng buộc | Tác động | Hướng xử lý |
| --- | --- | --- |
| High concurrency trong 10 phút đầu | Backend API quá tải, registration timeout. | Rate limiting bằng Redis, tách giới hạn endpoint đăng ký, graceful 429, optional waiting-room nhẹ. |
| Race condition khi giữ chỗ | Hai sinh viên cùng nhận chỗ cuối cùng. | PostgreSQL transaction với atomic update/row-level lock; chỉ tạo registration nếu giữ chỗ thành công. |
| Payment Gateway timeout hoặc lỗi kéo dài | Sinh viên không thanh toán được, backend bị nghẽn nếu retry liên tục. | Circuit Breaker, timeout ngắn, retry có kiểm soát, payment feature degrade độc lập. |
| Trừ tiền hai lần | Sai tài chính, khó đối soát. | Idempotency key, unique constraint, webhook idempotent, lưu payment callback. |
| Check-in offline | Mất dữ liệu hoặc sync trùng. | Local queue, idempotency key, batch sync, unique constraint theo QR/workshop, conflict log. |
| CSV lỗi hoặc dữ liệu trùng | Sai dữ liệu sinh viên, ảnh hưởng auth/registration. | Validate schema, upsert theo student_code/email, import job log, xử lý lỗi từng dòng. |
| Phân quyền nội bộ | Sinh viên truy cập admin hoặc staff scan trái quyền. | RBAC ở backend middleware/guard, route guard ở client, audit log. |
| AI Service timeout | Tạo summary chậm, ảnh hưởng trải nghiệm nếu xử lý đồng bộ. | Worker xử lý async; workshop vẫn hiển thị mô tả gốc nếu AI lỗi. |
| Notification provider lỗi | Email/app notification bị trễ. | Message broker, retry, log delivery; nghiệp vụ chính không rollback vì lỗi notification. |

## Định hướng spec-driven

Blueprint này tổ chức theo tinh thần OpenSpec: proposal nêu lý do và phạm vi, specs mô tả hành vi theo domain, design ghi quyết định kỹ thuật, tasks chuyển spec thành checklist triển khai. Dự án không tạo `openspec/changes/`; canonical output nằm trong `blueprint/`.
