# UniHub Workshop - Tài liệu Phân tích Tính năng

## 1. Giới thiệu

### 1.1 Mục tiêu hệ thống

UniHub Workshop là hệ thống quản lý tổng thể vòng đời workshop trong tuần lễ sự kiện tại trường đại học, từ khâu chuẩn bị (tạo workshop, cấu hình thông tin), đăng ký của sinh viên, tối ưu hoá ghế ngồi theo thời gian thực, cho đến khâu vận hành (check-in, quản lý dự phòng), và hỗ trợ sau sự kiện (tóm tắt nội dung qua AI).

### 1.2 Phạm vi tài liệu

Tài liệu này mô tả toàn bộ hệ thống bao gồm:

- **Chức năng dành cho sinh viên**: tìm kiếm, xem chi tiết, đăng ký workshop (miễn phí hoặc có thu phí), quản lý ticket/QR, nhận thông báo.
- **Chức năng dành cho ban tổ chức**: quản lý workshop (tạo, cập nhật, sửa phòng/giờ, hủy), xem thống kê.
- **Chức năng dành cho nhân sự check-in**: quét QR, ghi nhận check-in (hỗ trợ offline).
- **Chức năng hỗ trợ**: xử lý AI tự động tạo tóm tắt từ tài liệu PDF.

Tài liệu tập trung vào **domain problem**, **luồng nghiệp vụ**, và **các yêu cầu phi chức năng** để chuẩn bị cho bước phân tích kiến trúc, vẽ C4 diagram, xác định bounded context, và lựa chọn hướng triển khai.

### 1.3 Các nhóm người dùng chính

- **Sinh viên (Student)**: người tham dự workshop, có khả năng tự đăng ký, nhận QR, check-in.
- **Ban tổ chức (Organizer)**: quản lý toàn bộ workshop từ A–Z, cấu hình địa điểm, cộng tác với diễn giả, quản lý dung lượng, xem report.
- **Nhân sự check-in (Check-in Staff)**: sử dụng mobile app, quét mã QR, ghi nhận sự tham dự thực tế của sinh viên.
- **Hệ thống hỗ trợ (Supporting System)**: dịch vụ thanh toán, dịch vụ gửi thông báo (email, push notification, SMS), dịch vụ AI (LLM).

---

## 2. Tổng quan nghiệp vụ

### 2.1 Bài toán hệ thống giải quyết

Các sự kiện/tuần lễ có quy mô lớn trong nhà trường thường tổ chức **hàng chục workshop** song song, diễn ra trong **vài ngày liên tiếp**. Thách thức:

1. **Quản lý capacity theo thời gian thực**: Một phòng học có sức chứa hạn chế, các workshop khác nhau có độ phổ biến khác nhau, dễ xảy ra **overbooking** hoặc **lãng phí chỗ ngồi**.
2. **Ghi nhận sự tham dự**: Cần biết chính xác ai đã tham dự workshop nào để phục vụ chứng chỉ, thống kê, hoặc phân tích.
3. **Hỗ trợ đa hình thức thanh toán**: Một số workshop miễn phí, một số có thu phí (workshop đặc biệt, workshop liên hoan từ công ty).
4. **Khả năng mở rộng thông báo**: Sinh viên cần được thông báo qua nhiều kênh (app, email, SMS, Telegram, v.v.) mà hệ thống phải dễ dàng mở rộng.
5. **Tối ưu hoá trải nghiệm check-in**: Tránh tình trạng hàng dài tại các điểm check-in, đặc biệt là khi mạng bị gián đoạn.
6. **Tóm tắt nội dung workshop tự động**: Giảm tải công việc cho ban tổ chức, cung cấp ngay tóm tắt cho sinh viên (sơ cấp).

### 2.2 Giá trị mang lại cho từng nhóm người dùng

**Sinh viên:**

- Cổng duy nhất để khám phá, đăng ký, và theo dõi workshop mà bạn quan tâm.
- Tiếp cận thông tin chi tiết (diễn giả, nội dung sơ bộ từ AI summary, sơ đồ phòng).
- Trải nghiệm đăng ký mượt mà, check-in nhanh chóng (bằng QR).
- Thông báo kịp thời nếu có thay đổi phòng/giờ.

**Ban tổ chức:**

- **Một giao diện quản lý tập trung** cho tất cả workshop.
- **Khả năng linh hoạt** sửa đổi thông tin, điều phối lại phòng/giờ khi có tình huống (ví dụ: phòng bị hỏng).
- **Thống kê chi tiết**: ai đăng ký, ai tham dự, tỷ lệ show-up, phân bố yêu cầu cộng tác.
- **Giảm công việc nhân công**: AI tóm tắt nội dung PDF → không cần nhân viên tự gõ.

**Nhân sự check-in:**

- **Tăng tốc độ check-in**: Quét QR thay vì tra cứu danh sách, gõ tên.
- **Hỗ trợ offline**: Nếu mạng bị ngắt, vẫn có thể check-in tạm thời.
- **Đồng bộ tự động**: Khi khôi phục kết nối, dữ liệu tự đẩy lên server.

**Hệ thống tổng thể:**

- **Tự động hoá**: Xử lý hành chính, thống kê, thông báo → tiết kiệm chi phí.
- **Nền tảng mở rộng**: Dễ thêm các tính năng, kênh thông báo, hoặc tích hợp dịch vụ mới.

### 2.3 Các quy trình nghiệp vụ chính

1. **Quy trình tổ chức workshop**: Ban tổ chức tạo → cấu hình chi tiết (nội dung, diễn giả, phòng, giờ) → tải tài liệu PDF → AI tóm tắt → công bố cho sinh viên.
2. **Quy trình đăng ký**: Sinh viên xem danh sách → chọn workshop → đăng ký (có thể thanh toán) → nhận QR.
3. **Quy trình điều phối**: Ban tổ chức theo dõi đăng ký → phát hiện tình huống (phòng bị hỏng, mấy người đăng ký quá nhiều) → điều phối lại → thông báo sinh viên.
4. **Quy trình check-in**: Sinh viên đến sự kiện → check-in staff quét QR → ghi nhận sự tham dự → đồng bộ dữ liệu (nếu offline).
5. **Quy trình theo dõi & báo cáo**: Ban tổ chức xem thống kê tham dự, tỷ lệ show-up, phản hồi.

---

## 3. Danh sách Actor

### 3.1 Primary Actors (tương tác trực tiếp)

**Sinh viên (Student)**

- Role: Người tìm kiếm, đăng ký, và tham dự workshop.
- Tương tác với: hệ thống web/app để xem thông tin, đăng ký, nhận QR, nhận thông báo.

**Ban tổ chức (Organizer)**

- Role: Quản lý toàn bộ workshop, cấu hình chi tiết, kiểm soát dung lượng, xem báo cáo.
- Tương tác với: giao diện admin web nội bộ, tải tài liệu PDF, tạo/sửa/hủy workshop.

**Nhân sự check-in (Check-in Staff)**

- Role: Quét QR, ghi nhận check-in thực tế tại sự kiện.
- Tương tác với: mobile app, thực hiện check-in (online hoặc offline), đồng bộ dữ liệu.

### 3.2 Secondary Actors (hỗ trợ / external system)

**Dịch vụ thanh toán (Payment Gateway)**

- Hỗ trợ thanh toán cho workshop có thu phí.
- Tương tác: nhận yêu cầu thanh toán → xác nhận/từ chối → webhook callback về hệ thống.

**Dịch vụ thông báo (Notification Service)**

- Gửi email, push notification, SMS, Telegram, v.v.
- Tương tác: hệ thống gửi yêu cầu thông báo → dịch vụ gửi → xác nhận.

**Dịch vụ AI / LLM (AI Summarization Service)**

- Xử lý PDF: tách nội dung, làm sạch, gửi mô hình AI để tóm tắt.
- Tương tác: nhận tệp PDF hoặc nội dung tách ra → trả lại bản tóm tắt.

**Hệ thống authentication / LDAP (nếu tích hợp)**

- Xác thực người dùng bằng tài khoản nhà trường (email, MSSV).

---

## 4. Phân rã tính năng theo nhóm người dùng

### 4.1 Tính năng dành cho Sinh viên

#### 4.1.1 F1: Xem danh sách workshop

**Mô tả**
Sinh viên có thể xem danh sách toàn bộ workshop hoặc workshop lọc theo tiêu chí (ngày, thời gian, hạng mục, từ khóa tìm kiếm). Mỗi workshop trong danh sách hiển thị thông tin cơ bản: tên, diễn giả, thời gian, phòng, số chỗ còn lại, trạng thái (sắp diễn ra, đã bắt đầu, kết thúc).

**Mục tiêu**

- Cung cấp cổng duy nhất để sinh viên khám phá tất cả workshop.
- Hỗ trợ tìm kiếm, lọc nhanh.
- Hiển thị thông tin đủ để sinh viên quyết định xem chi tiết hay đăng ký ngay.

**Tiền điều kiện**

- Sinh viên đã đăng nhập.
- Hệ thống đã có ít nhất một workshop được công bố.

**Hậu điều kiện**

- Sinh viên nhìn thấy danh sách workshop.

**Luồng chính**

1. Sinh viên truy cập trang "Workshop" trên web/app.
2. Hệ thống hiển thị danh sách workshop mặc định (có thể sắp xếp theo ngày hoặc hạng mục).
3. Sinh viên có thể:
   - Lọc theo ngày, hạng mục, hoặc từ khóa tìm kiếm.
   - Xem số chỗ còn lại theo thời gian thực.
   - Nhấp vào workshop để xem chi tiết.

**Luồng ngoại lệ / Edge cases**

- Không có workshop nào: hiển thị thông báo "Chưa có workshop nào".
- Số chỗ bị hết giữa chừng: thay đổi trạng thái từ "Còn chỗ" sang "Hết chỗ" trong realtime.
- Workshop bị hủy: gỡ bỏ hoặc đánh dấu là "Đã hủy" trong danh sách.

**Dữ liệu liên quan**

- Danh sách workshop: ID, tên, diễn giả, thời gian bắt đầu/kết thúc, phòng, sức chứa, số người đã đăng ký.
- Metadata: hạng mục, mô tả ngắn, hình ảnh (nếu có).

**Lưu ý nghiệp vụ**

- Số chỗ còn lại phải **cập nhật realtime** để tránh tình trạng sinh viên thấy chỗ nhưng khi đăng ký lại hết.
- Cần hỗ trợ **lọc/sắp xếp** linh hoạt (ngày, giờ, hạng mục, độ phổ biến).

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **Realtime availability**: Cần cơ chế cập nhật số chỗ theo thời gian thực (WebSocket, Server-Sent Events, hoặc polling tuần hoàn).
- **Caching & Invalidation**: Danh sách workshop ít thay đổi, có thể cache phía client hoặc CDN, nhưng cần sẵn sàng invalidate khi có hủy/thay đổi.
- **Search & Filter Performance**: Nếu số lượng workshop rất lớn, cần xem xét indexing (Elasticsearch, v.v.) hoặc pagination.

---

#### 4.1.2 F2: Xem chi tiết workshop

**Mô tả**
Sinh viên xem toàn bộ thông tin chi tiết của một workshop: tên, diễn giả (kèm tiểu sử), nội dung (mô tả dài, sơ đồ phòng, tóm tắt AI), thời gian bắt đầu/kết thúc, địa điểm (tên phòng, sơ đồ), số chỗ còn lại, giá vé (nếu có), đánh giá/bình luận từ những người tham dự trước đó (nếu có).

**Mục tiêu**

- Cung cấp tất cả thông tin cần thiết để sinh viên quyết định có tham dự không.
- Hiển thị thông tin địa điểm, hình ảnh để sinh viên tự tin đi đến đúng phòng.

**Tiền điều kiện**

- Sinh viên đã đăng nhập.
- Workshop tồn tại và đã được công bố.

**Hậu điều kiện**

- Sinh viên có thể xem toàn bộ thông tin chi tiết.

**Luồng chính**

1. Sinh viên nhấp vào một workshop trong danh sách.
2. Hệ thống tải trang chi tiết workshop.
3. Hiển thị toàn bộ thông tin: mô tả, diễn giả, sơ đồ phòng, tóm tắt AI (nếu có), số chỗ còn lại, giá vé.
4. Sinh viên có thể:
   - Xem bình luận/đánh giá từ các sinh viên khác.
   - Đăng ký tham dự (nút "Đăng ký" hoặc "Thanh toán & Đăng ký").
   - Quay lại danh sách.

**Luồng ngoại lệ / Edge cases**

- Workshop bị hủy: thông báo rõ "Workshop này đã bị hủy" (thay vì hiển thị nút đăng ký).
- Hết chỗ: disablit nút "Đăng ký", hiển thị "Hết chỗ".
- Sinh viên đã đăng ký: thay nút "Đăng ký" thành "Đã đăng ký" (có thể có nút "Hủy đăng ký").
- Tóm tắt AI chưa sẵn sàng: hiển thị loading spinner hoặc thông báo "Đang tạo tóm tắt, vui lòng quay lại sau".

**Dữ liệu liên quan**

- Thông tin workshop: tên, mô tả đầy đủ, giá vé, sức chứa, số đã đăng ký, trạng thái.
- Thông tin diễn giả: tên, tiểu sử, ảnh đại diện.
- Thông tin phòng: tên phòng, vị trí, sơ đồ, dung lượng.
- Tóm tắt AI: nội dung tóm tắt, trạng thái (pending, done, error).
- Bình luận/đánh giá (nếu hệ thống hỗ trợ).

**Lưu ý nghiệp vụ**

- **Số chỗ còn lại** phải hiển thị realtime, cập nhật ngay khi có người đăng ký/hủy.
- **Tóm tắt AI** là thông tin hỗ trợ, không bắt buộc phải có để hiển thị chi tiết workshop.
- **Sơ đồ phòng** giúp sinh viên định hướng, tránh lạc.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **Tóm tắt AI là async process**: Tải file PDF → xử lý → gửi LLM → nhận kết quả. Cần queue/job, không thể đợi lâu.
- **Tóm tắt AI có thể fail**: Cần xử lý lỗi, retry logic, hoặc fallback (hiển thị mô tả gốc).
- **Caching tóm tắt AI**: Một khi có rồi, có thể cache lâu dài (trừ khi nội dung workshop thay đổi).
- **Realtime updates**: Khi số chỗ thay đổi, cần cập nhật realtime (dùng WebSocket hoặc polling).

---

#### 4.1.3 F3: Đăng ký workshop (miễn phí)

**Mô tả**
Sinh viên nhấp nút "Đăng ký" trên workshop miễn phí, hệ thống ghi nhận đăng ký, giới hạn không vượt quá sức chứa phòng. Sinh viên nhận ngay mã QR unique và thông báo xác nhận qua email/push.

**Mục tiêu**

- Ghi nhận nhu cầu tham dự từ sinh viên.
- Kiểm soát sức chứa, tránh overbooking.
- Phát hành mã QR check-in, giảm thời gian check-in tại sự kiện.

**Tiền điều kiện**

- Sinh viên đã đăng nhập.
- Workshop còn chỗ (số đã đăng ký < sức chứa).
- Workshop chưa bị hủy.
- Sinh viên chưa đăng ký workshop này.

**Hậu điều kiện**

- Sinh viên được ghi nhận vào danh sách đăng ký.
- Mã QR unique được tạo và lưu vào hệ thống.
- Thông báo xác nhận được gửi đi (email, push).
- Số chỗ còn lại giảm đi 1.

**Luồng chính**

1. Sinh viên xem chi tiết workshop, nhấp "Đăng ký".
2. Hệ thống kiểm tra:
   - Sinh viên đã đăng nhập?
   - Còn chỗ không?
   - Sinh viên chưa đăng ký workshop này?
3. Nếu đúng, hệ thống:
   - Tạo bản ghi Registration (student_id, workshop_id, timestamp, status=REGISTERED).
   - Tạo mã QR unique (token).
   - Giảm counter "số chỗ còn lại".
   - Gửi thông báo (email, push): "Bạn đã đăng ký thành công. Mã QR: [QR]".
4. Sinh viên nhìn thấy:
   - Xác nhận trên màn hình.
   - Mã QR để download/lưu.
   - Thông báo "Đã đăng ký" thay vì nút "Đăng ký".

**Luồng ngoại lệ / Edge cases**

- **Hết chỗ (race condition)**: Hai sinh viên cùng lúc đăng ký, chỉ có 1 chỗ. Hệ thống phải xử lý lỗi "Hết chỗ" cho sinh viên thứ hai. Cần **transaction mạnh** hoặc **distributed lock** để tránh overbooking.
- **Gửi thông báo fail**: Thông báo không gửi được (email server down, v.v.). Nên retry, hoặc lưu vào queue để gửi sau.
- **Sinh viên đăng ký lại**: Nếu bấm "Đăng ký" 2 lần nhanh chóng. Hệ thống phải idempotent (không tạo 2 bản ghi).
- **Workshop bị hủy sau khi đăng ký**: Sinh viên đã đăng ký nhưng workshop bị hủy. Cần thông báo và có thể hoàn tiền (nếu là workshop có thu phí).

**Dữ liệu liên quan**

- Bảng Registration: student_id, workshop_id, registration_time, status, qr_token.
- Bảng Workshop: id, name, capacity, registered_count, status.
- Thông tin sinh viên: email, phone (để gửi thông báo).

**Lưu ý nghiệp vụ**

- **Idempotency**: Nếu sinh viên bấm "Đăng ký" 2-3 lần nhanh chóng, hệ thống chỉ nên tạo 1 bản ghi.
- **Realtime capacity**: Số chỗ còn lại phải cập nhật realtime trên danh sách + trang chi tiết.
- **Đảm bảo không overbooking**: Ngay cả trong trường hợp traffic cao, hệ thống phải reject nếu đủ người rồi.
- **Notifikasi đáng tin cậy**: Email/push xác nhận có thể bị gửi chậm, nhưng phải gửi được.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **Capacity Control**: Cần **transaction** hoặc **distributed lock** (Redis, v.v.) để tránh overbooking trong high-traffic scenario.
- **Idempotency**: Bắt buộc phải có idempotency key (client gửi unique ID, hệ thống check xem ID này đã tồn tại chưa).
- **Notification Queue**: Đừng gửi email/push đồng bộ (có thể delay yêu cầu). Nên dùng queue (RabbitMQ, Kafka, v.v.) và xử lý async.
- **Concurrent Writes**: Giảm counter là write operation, cần atomic (ví dụ: dùng `UPDATE workshop SET registered_count = registered_count + 1 WHERE id = ?`).

---

#### 4.1.4 F4: Đăng ký workshop (có thu phí)

**Mô tả**
Tương tự như F3, nhưng khi đăng ký, sinh viên phải thanh toán tiền vé. Hệ thống tích hợp cổng thanh toán (ví dụ: VNPay, Momo, v.v.). Chỉ sau khi thanh toán thành công, đăng ký mới được xác nhận, QR được phát hành.

**Mục tiêu**

- Hỗ trợ workshop có thu phí (workshop ngoài, liên hoan công ty, v.v.).
- Đảm bảo thanh toán thành công trước khi xác nhận đăng ký.
- Quản lý doanh thu từ các workshop có phí.

**Tiền điều kiện**

- Sinh viên đã đăng nhập.
- Workshop còn chỗ.
- Workshop chưa bị hủy.
- Sinh viên chưa đăng ký workshop này.
- Cổng thanh toán khả dụng.

**Hậu điều kiện**

- Nếu thanh toán thành công:
  - Sinh viên được ghi nhận vào danh sách đăng ký.
  - Mã QR unique được tạo.
  - Thông báo xác nhận gửi đi.
  - Số chỗ còn lại giảm đi 1.
- Nếu thanh toán thất bại:
  - Không tạo bản ghi Registration.
  - Thông báo lỗi gửi đến sinh viên (yêu cầu thử lại).

**Luồng chính**

1. Sinh viên xem chi tiết workshop có phí, nhấp "Thanh toán & Đăng ký".
2. Hệ thống chuyển hướng đến trang thanh toán:
   - Hiển thị thông tin workshop (tên, giá).
   - Sinh viên nhập/chọn phương thức thanh toán.
3. Cổng thanh toán xử lý:
   - Gửi yêu cầu thanh toán.
   - Sinh viên hoàn thành thanh toán.
   - Cổng thanh toán gửi webhook callback về hệ thống.
4. Hệ thống xử lý webhook:
   - Kiểm tra chữ ký (signature) từ cổng thanh toán.
   - Nếu thành công: tạo Registration, QR, gửi thông báo.
   - Nếu thất bại: ghi log, không tạo Registration.
5. Hệ thống chuyển hướng sinh viên:
   - Nếu thành công: trang xác nhận (hiển thị QR, mã đơn hàng).
   - Nếu thất bại: thông báo lỗi, yêu cầu thử lại.

**Luồng ngoại lệ / Edge cases**

- **Webhook delay/loss**: Cổng thanh toán gửi webhook chậm hoặc không gửi (network issue). Hệ thống cần:
  - Polling cổng thanh toán để check trạng thái thanh toán (fallback).
  - Retry webhook.
  - Timeout xử lý.
- **Thanh toán partially**: Sinh viên gửi đôi khi lỗi mid-payment. Cần cancel toàn bộ hoặc refund nếu cần.
- **Duplicate payment**: Sinh viên bấm "Thanh toán" 2 lần. Nên sử dụng idempotency key từ phía client.
- **Hết chỗ sau khi thanh toán**: Trong quá trình thanh toán, workshop bị full. Cần xử lý refund hoặc chuyển sang waitlist.
- **Workshop bị hủy** sau khi thanh toán thành công: Cần refund.
- **Tỷ giá / tiền tệ**: Nếu hỗ trợ nhiều loại tiền, cần xử lý chuyển đổi.

**Dữ liệu liên quan**

- Bảng Registration: student_id, workshop_id, registration_time, status, qr_token, payment_status.
- Bảng Payment: id, student_id, workshop_id, amount, currency, payment_method, transaction_id (từ cổng thanh toán), status, timestamp.
- Thông tin Workshop: id, name, price, capacity, registered_count, status.

**Lưu ý nghiệp vụ**

- **Webhook xác thực**: Cải đơn chữ ký webhook từ cổng thanh toán, không để drift/man-in-the-middle.
- **Reconciliation**: Định kỳ so sánh trạng thái thanh toán trên hệ thống với cổng thanh toán.
- **Refund policy**: Quy định rõ: đầu/giữa/cuối sự kiện có refund không, mức phí refund.
- **Revenue tracking**: Theo dõi doanh thu từ từng workshop, từng phương thức thanh toán.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **Async payment callback**: Webhook từ cổng thanh toán không đồng bộ. Cần event-driven architecture (publish event khi thanh toán thành công).
- **Idempotency in payment**: Client nên gửi idempotency key. Server check key này: nếu đã xử lý rồi, trả kết quả cũ (không xử lý lại).
- **Payment state machine**: Cần định rõ các trạng thái thanh toán (PENDING, SUCCESS, FAILED, REFUNDED, v.v.) và transition hợp lệ.
- **Reconciliation batch job**: Hàng ngày/hàng giờ, batch job so sánh trạng thái với cổng thanh toán, phát hiện anomaly.
- **Distributed transaction**: Nếu thanh toán thành công nhưng việc tạo Registration fail, cần compensating transaction (refund hoặc manual intervention).
- **PCI Compliance**: Nếu lưu dữ liệu thẻ tín dụng, cần tuân thủ PCI DSS (tốt nhất nên để cổng thanh toán quản lý).

---

#### 4.1.5 F5: Xem QR & thông tin vé

**Mô tả**
Sau khi đăng ký (miễn phí hoặc trả phí), sinh viên có thể xem mã QR unique của mình (QR token) trên ứng dụng. Thông tin bao gồm:

- Mã QR (dưới dạng hình ảnh hoặc text).
- Mã vé (ticket ID).
- Thông tin workshop: tên, giờ, phòng.
- Trạng thái check-in (chưa check-in, đã check-in).
- Tùy chọn: download QR dưới dạng file, in QR.

**Mục tiêu**

- Sinh viên dễ dàng truy cập QR khi đến sự kiện.
- Hỗ trợ cả download/in QR cho những sinh viên muốn có bản cứng.

**Tiền điều kiện**

- Sinh viên đã đăng ký workshop.
- Mã QR đã được tạo và lưu trong hệ thống.

**Hậu điều kiện**

- Sinh viên có thể xem/download/in QR.

**Luồng chính**

1. Sinh viên mở ứng dụng, vào mục "Vé của tôi" hoặc "Đăng ký của tôi".
2. Hiển thị danh sách workshop mà sinh viên đã đăng ký.
3. Sinh viên chọn một workshop.
4. Hệ thống hiển thị:
   - Mã QR (hình ảnh to, dễ quét).
   - Mã vé (text).
   - Thông tin workshop.
   - Trạng thái check-in.
5. Sinh viên có thể:
   - Download QR (PNG/PDF).
   - In QR.
   - Chia sẻ với bạn bè (social media).

**Luồng ngoại lệ / Edge cases**

- **QR code expired**: Nếu workshop đã kết thúc, QR không còn hợp lệ. Hiển thị thông báo.
- **QR code đã dùng (check-in rồi)**: Hiển thị "Đã check-in" thay vì QR có thể quét.
- **Sinh viên đã hủy đăng ký**: QR không còn hợp lệ, hiển thị thông báo.
- **Download QR fail**: Nếu hệ thống không thể tạo file (ví dụ: hết dung lượng), thông báo lỗi.

**Dữ liệu liên quan**

- Bảng Registration: qr_token, student_id, workshop_id, status, check_in_time.
- Thông tin workshop: tên, giờ, phòng.
- Mã vé: ticket_id (có thể là một phần của qr_token hoặc riêng).

**Lưu ý nghiệp vụ**

- **Bảo mật QR**: Mã QR là bí mật, chỉ sinh viên chính chủ hoặc staff check-in mới được xem. Cần phân quyền.
- **QR reusability**: Một sinh viên có thể chia sẻ QR cho bạn bè. Để tránh, hệ thống có thể:
  - Ghi nhận lần đầu check-in, QR không còn dùng được.
  - Hoặc dùng biometric (nếu hệ thống hỗ trợ), check mặt/vân tay khi check-in.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **QR code generation**: Có thể generate on-the-fly (nhanh) hoặc pre-generate (an toàn hơn). Cân nhắc trade-off.
- **QR format**: Dùng QR standard (ISO/IEC 18004), nhúng thông tin gì vào QR (ví dụ: student_id, workshop_id, timestamp)?
- **QR validation**: Staff check-in quét QR, hệ thống validate token, check xem có hợp lệ không (chưa check-in, workshop chưa hết giờ, v.v.).
- **QR expiry**: Set TTL cho QR token, hoặc expire ngay sau khi check-in.

---

#### 4.1.6 F6: Nhận thông báo

**Mô tả**
Sinh viên nhận thông báo qua nhiều kênh (email, push notification, SMS, Telegram, v.v.) về:

- Xác nhận đăng ký workshop.
- Thay đổi thông tin workshop (phòng, giờ, hủy).
- Nhắc nhở trước workshop (ví dụ: 30 phút trước).
- Kết quả check-in (nếu hệ thống hỗ trợ).

Hệ thống cho phép sinh viên:

- Chọn kênh thông báo ưu tiên.
- Tắt/bật thông báo cho từng workshop hoặc toàn bộ.
- Quản lý tần suất thông báo (tránh spam).

**Mục tiêu**

- Đảm bảo sinh viên luôn cập nhật thông tin workshop.
- Giảm tỷ lệ no-show (không đến dự) bằng nhắc nhở.
- Hỗ trợ linh hoạt nhiều kênh thông báo, dễ mở rộng.

**Tiền điều kiện**

- Sinh viên đã đăng ký workshop.
- Hệ thống có thông tin liên lạc (email, phone, Telegram ID, v.v.).
- Dịch vụ thông báo (email, SMS, push, v.v.) khả dụng.

**Hậu điều kiện**

- Sinh viên nhận thông báo (bất kỳ kênh nào được chọn).

**Luồng chính**

1. **Sự kiện trigger thông báo** (ví dụ: sinh viên đăng ký thành công).
2. Hệ thống ghi log sự kiện vào notification queue.
3. Notification service (async) xử lý queue:
   - Kiểm tra tùy chọn thông báo của sinh viên (enabled/disabled, kênh ưu tiên).
   - Gửi thông báo qua từng kênh đã chọn (email, push, SMS, v.v.).
   - Ghi nhận kết quả gửi (success/failure).
4. Sinh viên nhận thông báo trên các kênh của mình.

**Luồng ngoại lệ / Edge cases**

- **Gửi thông báo fail**: Email server down, SMS gateway bị lỗi. Hệ thống nên retry (exponential backoff), hoặc fallback sang kênh khác.
- **Sinh viên không chọn kênh nào**: Mặc định dùng email hoặc thông báo on-app.
- **Thông báo spam**: Nếu gửi quá nhiều, sinh viên sẽ bỏ qua. Cần throttling (ví dụ: không gửi quá 3 thông báo/ngày).
- **Thông tin liên lạc sai/cũ**: Email hoặc phone đã thay đổi. Hệ thống cần cho phép sinh viên cập nhật.
- **Workshop bị hủy**: Gửi thông báo ngay, trước khi workshop khai mạc.

**Dữ liệu liên quan**

- Bảng Notification Preference: student_id, email, phone, telegram_id, enabled_channels (list), is_active.
- Bảng NotificationLog: id, student_id, workshop_id, event_type, channels (list), status (sent/failed), timestamp.
- Bảng NotificationTemplate: event_type, template_subject, template_body (cho email, SMS, push, Telegram).

**Lưu ý nghiệp vụ**

- **Dễ mở rộng kênh**: Khi có kênh mới (Telegram, WhatsApp, v.v.), nên dễ dàng thêm vào hệ thống.
- **Throttling/Rate limiting**: Tránh gửi quá nhiều thông báo → sinh viên mute → mất liên lạc.
- **Opt-in/Opt-out**: Sinh viên phải có lựa chọn bật/tắt thông báo (yêu cầu pháp luật về GDPR, TCPA).
- **Tiếng Việt support**: Thông báo phải có tiếng Việt (nếu sinh viên là người Việt).

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **Notification service**: Nên tách riêng thành microservice/component để dễ scale, reuse, test. Một số option:
  - In-house notification service (queue + workers).
  - Third-party service (SendGrid, Twilio, Firebase Cloud Messaging, v.v.).
- **Channel abstraction**: Thiết kế layer abstraction cho notification (INotificationChannel, EmailChannel, SMSChannel, v.v.) để dễ thêm channel mới.
- **Async queue**: Đừng gửi thông báo đồng bộ (có thể delay hệ thống). Dùng queue (RabbitMQ, Kafka, Redis, v.v.).
- **Retry logic**: Exponential backoff khi gửi thất bại. Tuy nhiên, cần set max retry để tránh infinite retry.
- **Idempotency**: Nếu worker crash và restart, cần tránh gửi lại thông báo (dùng message ID).
- **Monitoring**: Track delivery rate, failure rate, latency của từng channel.

---

### 4.2 Tính năng dành cho Ban tổ chức

#### 4.2.1 F7: Tạo workshop mới

**Mô tả**
Ban tổ chức (admin) truy cập giao diện admin web, điền thông tin workshop mới:

- Tên workshop.
- Diễn giả (tên, tiểu sử, ảnh đại diện).
- Mô tả chi tiết, nội dung dự kiến.
- Thời gian (ngày, giờ bắt đầu, giờ kết thúc).
- Phòng (chọn từ danh sách phòng có sẵn).
- Sức chứa (hoặc lấy từ thông tin phòng).
- Giá vé (0 = miễn phí, >0 = có phí).
- Hạng mục workshop (track, domain).
- Tải tài liệu PDF (để tạo tóm tắt AI).
- Trạng thái (DRAFT, PUBLISHED, CANCELLED).

Sau khi tạo, workshop chuyển sang trạng thái DRAFT, ban tổ chức có thể tiếp tục chỉnh sửa trước khi công bố (PUBLISHED).

**Mục tiêu**

- Cung cấp form/UI cho ban tổ chức tạo workshop dễ dàng.
- Xác thực dữ liệu đầu vào (không để thời gian invalid, phòng trùng, v.v.).

**Tiền điều kiện**

- Ban tổ chức đã đăng nhập với role "Organizer" hoặc "Admin".
- Tuần lễ sự kiện đã được tạo sẵn.
- Danh sách phòng trong hệ thống.

**Hậu điều kiện**

- Workshop được tạo mới, lưu vào cơ sở dữ liệu.
- Trạng thái = DRAFT.
- Ban tổ chức có thể tiếp tục chỉnh sửa.

**Luồng chính**

1. Ban tổ chức mở trang "Tạo Workshop Mới" trong admin.
2. Điền form:
   - Tên, mô tả, diễn giả, thời gian, phòng, giá, hạng mục, PDF (optional).
3. Hệ thống validate:
   - Tên không trống.
   - Thời gian hợp lệ (bắt đầu < kết thúc, trong tuần lễ sự kiện).
   - Phòng tồn tại, không bị book lúc đó (hoặc cho phép overlap nếu phòng khác nhau).
   - Sức chứa >= 0.
   - Giá >= 0.
4. Nếu valid, hệ thống:
   - Tạo bản ghi Workshop (status=DRAFT).
   - Nếu có PDF, trigger async job để xử lý PDF và tạo tóm tắt AI (async, không chặn).
   - Hiển thị xác nhận cho ban tổ chức.
5. Ban tổ chức có thể:
   - Chỉnh sửa workshop (vẫn DRAFT).
   - Công bố workshop (thay đổi status = PUBLISHED).

**Luồng ngoại lệ / Edge cases**

- **Phòng bị book**: Nếu phòng đã có workshop khác cùng lúc, hệ thống warning (cho phép nếu là intent, hoặc reject).
- **PDF upload fail**: Nếu file quá lớn hoặc format không hỗ trợ, reject upload.
- **Tóm tắt AI error**: Nếu quá trình AI fail (LLM timeout, v.v.), lưu log, thông báo ban tổ chức, để tóm tắt pending.
- **Thay đổi giữa chừng**: Ban tổ chức edit workshop DRAFT, hệ thống cập nhật realtime.

**Dữ liệu liên quan**

- Bảng Workshop: id, name, description, speaker_id, speaker_name, speaker_bio, speaker_image_url, start_time, end_time, room_id, capacity, price, category, status, created_at, updated_at, created_by (organizer_id).
- Bảng Speaker: id, name, bio, image_url.
- Bảng Room: id, name, capacity, location, floor.
- Bảng WorkshopFile: id, workshop_id, file_type (PDF, v.v.), file_url, upload_time.
- Bảng AISummary: id, workshop_id, status (pending, processing, done, error), summary_text, error_msg, created_at.

**Lưu ý nghiệp vụ**

- **Xác thực giờ**: Thời gian workshop không nên trùng với sự kiện khác trong tuần lễ (hoặc là cấu hình chung).
- **Phòng booking**: Một phòng có thể có multiple workshop nếu khác giờ.
- **PDF xử lý async**: Không chờ kết quả AI, để user proceed ngay, tóm tắt load sau.
- **Speaker info**: Có thể tạo speaker mới hoặc chọn từ danh sách cũ.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **PDF processing pipeline**: Tải file → lưu → queue job → worker xử lý (extract text, clean, gửi LLM) → lưu kết quả. Nên async, không block request.
- **Validation & constraints**: Cần validate business rule (phòng không trùng, thời gian hợp lệ, v.v.). Có thể dùng database constraint + application validation.
- **Draft vs Published**: Chỉ PUBLISHED workshop mới hiển thị cho sinh viên. DRAFT là working state.
- **Audit log**: Ghi lại ai tạo, ai sửa, lúc nào (để compliance, debugging).

---

#### 4.2.2 F8: Cập nhật thông tin workshop

**Mô tả**
Ban tổ chức có thể cập nhật thông tin workshop mà chưa có đăng ký hoặc đã có đăng ký. Có thể sửa:

- Tên, mô tả.
- Diễn giả.
- Giờ (nếu chưa có đăng ký → dễ, nếu có đăng ký → cần thông báo).
- Phòng (similar).
- Sức chứa (có thể tăng/giảm, nhưng không được < số đã đăng ký).
- Giá vé (nếu thay đổi, có thể ảnh hưởng các pending payment).
- Hạng mục.
- PDF (upload mới → cập nhật tóm tắt AI).

**Mục tiêu**

- Cho phép ban tổ chức linh hoạt điều chỉnh chi tiết workshop.
- Đảm bảo tính nhất quán (không overbooking, không lỗi logic).
- Thông báo sinh viên nếu có thay đổi quan trọng.

**Tiền điều kiện**

- Ban tổ chức đã đăng nhập.
- Workshop tồn tại.

**Hậu điều kiện**

- Thông tin workshop được cập nhật.
- Nếu thay đổi quan trọng (phòng, giờ), thông báo gửi đến sinh viên đã đăng ký.

**Luồng chính**

1. Ban tổ chức mở trang "Chỉnh sửa Workshop".
2. Form pre-fill với thông tin hiện tại.
3. Ban tổ chức thay đổi các trường.
4. Hệ thống validate (similar F7).
5. Nếu có thay đổi **quan trọng** (phòng, giờ, hủy):
   - Trigger event "workshop_changed" → notification service gửi thông báo.
6. Cập nhật database.
7. Hiển thị xác nhận, danh sách sự thay đổi nếu cần.

**Luồng ngoại lệ / Edge cases**

- **Giảm sức chứa < số đăng ký**: Reject, thông báo "Sức chứa mới không đủ cho các đăng ký hiện tại".
- **Thay đổi giờ**: Kiểm tra xem phòng có bị conflict không.
- **Thay đổi PDF**: Trigger re-processing AI summary.
- **Workshop đã khai mạc**: Nên disable việc thay đổi thông tin quan trọng (chỉ có thể sửa minor details).

**Dữ liệu liên quan**

- Bảng Workshop (update).
- Bảng WorkshopHistory (audit log): workshop_id, field_changed, old_value, new_value, changed_at, changed_by.
- Thông báo cho sinh viên đã đăng ký.

**Lưu ý nghiệp vụ**

- **Thay đổi giờ/phòng**: Cần thông báo ngay sinh viên → ảnh hưởng đến lịch của họ.
- **Audit trail**: Ghi chép chi tiết ai sửa gì, lúc nào (compliance + debugging).
- **Workshop không thay đổi sau khai mạc**: Business rule tuỳ, nhưng thường nên lock.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **Optimistic/pessimistic locking**: Nếu multiple organizer cùng edit workshop, cần conflict resolution.
- **Event sourcing**: Có thể consider event sourcing để track mọi thay đổi.
- **Notification trigger**: Khi detect thay đổi quan trọng, publish event → notification service.
- **Versioning**: Có thể lưu version của workshop để rollback nếu cần.

---

#### 4.2.3 F9: Hủy workshop

**Mô tả**
Ban tổ chức hủy một workshop. Hành động này:

- Thay đổi trạng thái workshop thành CANCELLED.
- Gửi thông báo đến tất cả sinh viên đã đăng ký (refund nếu có phí).
- Nếu workshop có phí, cần xử lý refund.
- Có thể lưu giải thích tại sao hủy (để ghi nhận lịch sử).

**Mục tiêu**

- Cho phép ban tổ chức hủy workshop khi cần (phòng không khả dụng, diễn giả bị dịch chuyển, v.v.).
- Đảm bảo sinh viên được thông báo và hoàn tiền (nếu cần).

**Tiền điều kiện**

- Ban tổ chức đã đăng nhập.
- Workshop tồn tại, chưa bị hủy.

**Hậu điều kiện**

- Workshop status = CANCELLED.
- Thông báo hủy gửi đến all registered students.
- Refund được xử lý (nếu có phí).

**Luồng chính**

1. Ban tổ chức mở trang chi tiết workshop, nhấp "Hủy Workshop".
2. Hệ thống hiển thị xác nhận:
   - Số sinh viên đã đăng ký: X.
   - Nếu có phí, số tiền cần hoàn: Y.
   - Trường nhập lý do hủy (optional).
3. Ban tổ chức xác nhận.
4. Hệ thống:
   - Cập nhật status workshop = CANCELLED.
   - Gửi refund (nếu có phí) → cổng thanh toán.
   - Publish event "workshop_cancelled" → notification service gửi thông báo.
   - Ghi log hủy.
5. Hiển thị xác nhận hoàn thành.

**Luồng ngoại lệ / Edge cases**

- **Refund fail**: Cổng thanh toán bị lỗi. Hệ thống cần:
  - Ghi log chi tiết refund pending.
  - Retry sau.
  - Hoặc manual refund bởi admin.
- **Workshop đang diễn ra**: Nên disable hủy nếu workshop đã bắt đầu.
- **Partial refund**: Nếu workshop đã diễn ra 50%, refund 50% (tuỳ policy).

**Dữ liệu liên quan**

- Bảng Workshop: id, status (update = CANCELLED), cancelled_at, cancelled_by, cancellation_reason.
- Bảng Registration: workshop_id = cancelled workshop.
- Bảng Payment/Refund: ghi log refund transaction.

**Lưu ý nghiệp vụ**

- **Refund policy**: Quy định rõ (full refund, no refund, partial refund tùy thời điểm).
- **Notification**: Thông báo phải rõ ràng, có hướng dẫn claim refund (nếu cần).
- **Historical record**: Giữ workshop record để audit.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tâm**

- **Refund integration**: Tích hợp với payment gateway để gửi refund request.
- **Compensation transaction**: Nếu refund fail, cần compensating logic (retry, manual, v.v.).
- **Event-driven**: Publish event "workshop_cancelled" để các service khác react (notification, refund, v.v.).
- **Soft delete vs hard delete**: Nên soft delete (set status = CANCELLED) chứ không hard delete (để audit).

---

#### 4.2.4 F10: Xem thống kê / dashboard

**Mô tả**
Ban tổ chức xem dashboard thống kê toàn cảnh:

- Số workshop đang diễn ra, sắp diễn ra, đã kết thúc.
- Tổng số sinh viên đã đăng ký (toàn sự kiện hoặc từng workshop).
- Tỷ lệ show-up (số check-in / số đã đăng ký).
- Workshop nào đông nhất, ít nhất.
- Tổng doanh thu (từ workshop có phí).
- Trending: workshop nào đang hot (nhiều đăng ký gần đây).

Có thể drill-down từng workshop để xem:

- Danh sách sinh viên đã đăng ký (có thể export).
- Danh sách sinh viên đã check-in.
- Danh sách sinh viên "no-show" (đăng ký nhưng không check-in).

**Mục tiêu**

- Giúp ban tổ chức theo dõi tình hình sự kiện.
- Phát hiện vấn đề (workshop quá đông, quá vắng, v.v.).
- Phục vụ báo cáo sau sự kiện (cho leadership).

**Tiền điều kiện**

- Ban tổ chức đã đăng nhập.

**Hậu điều kiện**

- Hiển thị dashboard thống kê.

**Luồng chính**

1. Ban tổ chức mở trang "Dashboard" / "Thống kê".
2. Hệ thống hiển thị:
   - Overview metrics (số workshop, số đăng ký, tỷ lệ show-up, doanh thu).
   - Biểu đồ: số đăng ký theo giờ, số check-in theo giờ, phân bố theo hạng mục.
   - Bảng xếp hạng workshop (top 10 most popular).
3. Ban tổ chức có thể:
   - Lọc theo ngày, hạng mục, trạng thái.
   - Click vào workshop để xem chi tiết.
   - Export báo cáo (Excel, PDF).

**Luồng ngoại lệ / Edge cases**

- **Dữ liệu realtime delay**: Nếu dùng batch job để tính toán, có thể có delay 5-10 phút. Cần label "last updated".
- **Performance**: Nếu sự kiện rất lớn (10k+ sinh viên), tính toán thống kê có thể chậm. Nên cache, pre-compute.

**Dữ liệu liên quan**

- Bảng Workshop, Registration, CheckInRecord.
- Pre-computed stats (hoặc on-the-fly tính toán).

**Lưu ý nghiệp vụ**

- **Real-time vs batch**: Cần quyết định có real-time update không, hay batch hourly.
- **Data privacy**: Không expose dữ liệu sinh viên riêng lẻ nếu không cần.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **Analytics DB**: Nên tách analytics query ra database khác (OLAP) để không ảnh hưởng OLTP (transactional).
- **Batch job**: Hàng giờ, tính toán metrics, lưu vào cache/table.
- **Caching**: Cache metrics ngắn hạn (5-10 phút) để tránh re-compute liên tục.
- **Visualization**: Dùng charting library (Chart.js, D3, v.v.) để vẽ biểu đồ.
- **Export**: Hỗ trợ export Excel (dùng library như xlsx).

---

### 4.3 Tính năng dành cho Nhân sự Check-in

#### 4.3.1 F11: Check-in bằng quét QR

**Mô tả**
Nhân sự check-in dùng mobile app để quét mã QR của sinh viên (QR từ F5). Sau khi quét thành công:

- Hệ thống xác nhận sinh viên + workshop + timestamp.
- Ghi nhận vào bảng CheckInRecord.
- Hiển thị thông báo "Check-in thành công" (hoặc fail nếu QR không hợp lệ).
- Update trạng thái "đã check-in" trên sinh viên.

**Mục tiêu**

- Ghi nhận sự tham dự thực tế của sinh viên.
- Tăng tốc độ check-in (quét QR nhanh hơn gõ tên).
- Cung cấp dữ liệu chính xác cho báo cáo.

**Tiền điều kiện**

- Nhân sự check-in đã đăng nhập vào mobile app.
- Có internet connection (hoặc offline mode).
- Sinh viên có QR code hợp lệ.
- Workshop đã khai mạc (hoặc sắp khai mạc, không trong quá khứ).

**Hậu điều kiện**

- CheckInRecord được tạo.
- Trạng thái registration được update (check_in_status = CHECKED_IN, check_in_time = timestamp).

**Luồng chính**

1. Nhân sự mở mobile app, chọn workshop.
2. Nhấp "Quét QR" → camera mở.
3. Quét mã QR của sinh viên.
4. Hệ thống parse QR token.
5. Gửi request đến server (hoặc xử lý offline):
   - Validate QR token: tồn tại, chưa check-in, workshop hợp lệ, thời gian hợp lệ.
6. Nếu valid:
   - Tạo CheckInRecord: workshop_id, student_id, check_in_time, staff_id.
   - Update Registration: check_in_status = CHECKED_IN.
   - Hiển thị: "✓ [Student Name] - Check-in thành công".
7. Nếu không valid:
   - Hiển thị lỗi: "Mã QR không hợp lệ" / "Sinh viên đã check-in" / "Workshop không đúng".

**Luồng ngoại lệ / Edge cases**

- **QR code không hợp lệ**: Invalid format, hoặc token không tồn tại → thông báo "Mã QR không hợp lệ, vui lòng thử lại".
- **Sinh viên đã check-in rồi**: Mã QR đã được dùng → thông báo "Sinh viên này đã check-in rồi lúc [timestamp]".
- **Workshop chưa khai mạc**: Check-in trước thời gian bắt đầu → tuỳ policy (có thể cho check-in sớm 15 phút, hoặc block).
- **Workshop đã kết thúc**: Không cho check-in → thông báo "Workshop đã kết thúc".
- **Sinh viên đã hủy đăng ký**: QR không còn hợp lệ.
- **Quét QR 2 lần liên tiếp**: Idempotency → check-in lần 2 nhận kết quả "đã check-in".
- **Network lỗi**: Xem F12 (offline mode).

**Dữ liệu liên quan**

- QR token (từ Registration).
- Bảng CheckInRecord: id, workshop_id, student_id, check_in_time, staff_id, latitude, longitude (nếu tracking).
- Bảng Registration: check_in_status, check_in_time (update).

**Lưu ý nghiệp vụ**

- **QR reusability**: Một QR chỉ được check-in một lần.
- **Timing**: Check-in nên diễn ra trong thời gian workshop, hoặc trước N phút.
- **Multiple check-in**: Nếu sinh viên quét QR 2 lần, chỉ ghi nhận 1 lần (idempotent).
- **Staff tracking**: Ghi lại staff nào check-in (audit).

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **QR scanning**: Dùng camera library (ZXing, barcode-scanner, v.v.).
- **QR validation**: Server validate token, check timestamp, status, v.v.
- **Idempotency**: Nếu quét lại, phải return kết quả cũ (check-in lần 1), không tạo record mới.
- **Latency**: Quét xong phải response nhanh (< 1s) để staff chờ được.
- **Failure handling**: Network error → offline queue (xem F12).
- **Analytics**: Ghi lại scan failures để debugging (ví dụ: staff quét sai, QR blur, v.v.).

---

#### 4.3.2 F12: Check-in offline & sync

**Mô tả**
Mobile app có chế độ offline-first: khi mất kết nối internet, nhân sự check-in vẫn có thể quét QR. Dữ liệu được lưu tạm vào local database (SQLite hoặc Realm). Khi khôi phục kết nối, app tự động sync dữ liệu lên server.

**Mục tiêu**

- Đảm bảo nhân sự check-in không bị gián đoạn ngay cả khi mất mạng.
- Giảm dependencies vào network.
- Cung cấp trải nghiệm smooth ngay cả trong tình huống xấu.

**Tiền điều kiện**

- Mobile app support offline database.
- Network disconnected hoặc latency cao.

**Hậy điều kiện**

- CheckInRecord được lưu offline.
- Khi online lại, dữ liệu sync lên server.

**Luồng chính**

_Offline mode:_

1. Nhân sự quét QR.
2. App cố gắng gửi request đến server.
3. Nếu timeout/fail → fallback to offline mode:
   - Validate QR token cục bộ (parse, format check).
   - Lưu vào local DB: {qr_token, workshop_id, student_id, check_in_time, staff_id, sync_status=PENDING}.
   - Hiển thị "✓ Check-in thành công (sẽ đồng bộ khi có mạng)".

_Online recovery:_

1. App detect network available (network listener).
2. Trigger sync:
   - Query local DB: SELECT \* WHERE sync_status = PENDING.
   - Batch gửi tất cả pending records lên server.
3. Server xử lý:
   - Validate từng record (có thể fail nếu sinh viên đã check-in online từ device khác).
   - Tạo CheckInRecord nếu valid, skip nếu duplicate.
   - Return status cho app.
4. App cập nhật local DB: sync_status = SYNCED (nếu success) hoặc FAILED (nếu error).
5. Hiển thị sync result cho staff.

**Luồng ngoại lệ / Edge cases**

- **Duplicate check-in**: Sinh viên check-in offline lúc 10:00 từ device A, rồi check-in online lúc 10:05 từ device B (staff khác). Server detect duplicate, reject device B.
- **Sync fail**: Server return error (ví dụ: QR token invalid, workshop cancelled). App cập nhật local status = FAILED, alert staff.
- **Partial sync**: Một số record sync thành công, một số fail. App cần display chi tiết mỗi record.
- **Network on/off liên tục**: App cần robust handling (không retry quá nhiều, throttle).
- **Device memory full**: Local DB bị đầy. Cần clean up old data (ví dụ: xoá data sync > 7 ngày).
- **QR format validation offline**: Offline validation chỉ basic (format, không call server). Có thể miss một số edge case.

**Dữ liệu liên quan**

- Local DB (SQLite):
  - Table: pending_check_ins {qr_token, workshop_id, student_id, check_in_time, staff_id, sync_status, sync_at}.
- Server DB:
  - Bảng CheckInRecord (tương tự).

**Lưu ý nghiệp vụ**

- **Sync timing**: Có thể auto-sync ngay khi online, hoặc staff có thể manually trigger "Sync" button.
- **Conflict resolution**: Nếu duplicate, cách xử lý là gì? (Ignore, alert staff, v.v.).
- **Data retention**: Bao lâu thì có thể xoá old pending data?
- **Accountability**: Ghi lại staff nào check-in offline, để audit.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **Local database**: SQLite (lightweight, tích hợp sẵn) hoặc Realm (nhanh hơn, support sync).
- **Sync strategy**: Batch upload all pending, hoặc incremental? Batch đơn giản hơn.
- **Conflict detection**: Server side: check xem record đã tồn tại (unique key: workshop_id + student_id + check_in_time) không.
- **Exponential backoff**: Nếu sync fail, retry với delay exponential (1s, 2s, 4s, ..., max 60s).
- **Idempotency key**: Client gửi unique ID cho mỗi check-in, server dùng ID này để detect duplicate.
- **Offline-first framework**: Có thể dùng library như Realm, SQLite, hoặc PouchDB (cho web).
- **Monitoring**: Track sync success rate, failure rate, lag time.

---

### 4.4 Tính năng AI / Hỗ trợ

#### 4.4.1 F13: Tải file PDF & xử lý tóm tắt AI

**Mô tả**
Ban tổ chức tải file PDF giới thiệu workshop (khi tạo hoặc cập nhật workshop). Hệ thống:

1. Lưu file PDF.
2. Trigger async job để xử lý:
   - Tách nội dung từ PDF (PDF parsing).
   - Làm sạch văn bản (cleaning).
   - Gửi nội dung đến AI service (LLM) để tạo tóm tắt.
3. Lưu kết quả tóm tắt vào database.
4. Hiển thị tóm tắt trên trang chi tiết workshop (xem F2).

**Mục tiêu**

- Tự động tạo tóm tắt workshop từ tài liệu gốc.
- Giảm công việc nhân công cho ban tổ chức (không cần gõ tóm tắt).
- Cung cấp nội dung sơ cấp cho sinh viên.

**Tiền điều kiện**

- Ban tổ chức tải file PDF khi tạo/cập nhật workshop.
- AI service khả dụng.

**Hậu điều kiện**

- File PDF lưu vào storage.
- Async job được queue, xử lý, kết quả tóm tắt lưu vào database.

**Luồng chính**

_Upload PDF:_

1. Ban tổ chức tải file PDF trên form "Tạo Workshop" hoặc "Chỉnh sửa Workshop".
2. Hệ thống validate:
   - File type = PDF.
   - File size <= MAX_SIZE (ví dụ: 10MB).
3. Nếu valid:
   - Lưu file vào storage (S3, local storage, v.v.).
   - Tạo bản ghi WorkshopFile.
   - Publish event "pdf_uploaded" → trigger async job.

_Async PDF processing:_

1. Worker/job queue nhận event "pdf_uploaded".
2. Tải file PDF từ storage.
3. Extract text từ PDF (dùng library như PyPDF2, pdfplumber).
4. Clean text: loại bỏ header/footer, ký tự lạ, format lại.
5. Gửi request đến AI service (LLM API):
   - Input: cleaned text.
   - Prompt: "Tóm tắt ngắn gọn nội dung workshop trong 3-5 câu tiếng Việt".
   - Output: summary text.
6. Nếu success:
   - Tạo bản ghi AISummary: workshop_id, status=DONE, summary_text, created_at.
   - Publish event "summary_done" → notification (optional).
7. Nếu error:
   - Log error chi tiết.
   - Tạo bản ghi AISummary: status=ERROR, error_msg.
   - Admin sẽ nhận notification hoặc thấy trong dashboard.

_Hiển thị tóm tắt:_

1. Khi sinh viên xem chi tiết workshop (F2), hệ thống check AISummary.
2. Nếu status=DONE, hiển thị summary.
3. Nếu status=PENDING/PROCESSING, hiển thị "Đang tạo tóm tắt..."
4. Nếu status=ERROR, hiển thị thông báo hoặc skip (hiển thị mô tả gốc).

**Luồng ngoại lệ / Edge cases**

- **PDF upload fail**: File corrupt, server gặp lỗi lúc upload. Thông báo ban tổ chức, cho phép retry.
- **PDF parsing fail**: File PDF format lạ, không extract được text. Log error, status=ERROR, admin handle manual.
- **AI service timeout**: LLM bị chậm hoặc offline. Retry sau, với backoff strategy.
- **AI service fail**: LLM return error (invalid input, rate limit, v.v.). Log, alert admin.
- **Empty summary**: LLM return empty text. Log as warning, admin có thể edit manually.
- **Non-Vietnamese content**: Nếu PDF không phải tiếng Việt, LLM output có thể không tốt. System làm best effort.
- **Very long PDF**: Nếu PDF rất dài, có thể timeout hoặc exceed token limit. Cần truncate input hoặc chunk processing.

**Dữ liệu liên quan**

- Bảng WorkshopFile: id, workshop_id, file_type, file_url, file_size, upload_at, uploader_id.
- Bảng AISummary: id, workshop_id, status (pending, processing, done, error), summary_text, error_msg, created_at, updated_at.

**Lưu ý nghiệp vụ**

- **PDF tái sử dụng**: Nếu PDF giống nhau, có thể reuse summary (cache).
- **Manual override**: Ban tổ chức có thể edit tóm tắt AI (không để 100% rely on AI).
- **Feedback loop**: Collect feedback từ sinh viên về chất lượng tóm tắt (optional, để cải thiện).
- **Multiple language**: Nếu workshop có content tiếng Anh hoặc tiếng khác, AI cần hỗ trợ.

**Gợi ý kỹ thuật / Các vấn đề kiến trúc cần quan tăm**

- **Async job queue**: RabbitMQ, Celery, Cloud Tasks, v.v. Không nên process PDF đồng bộ (block request).
- **PDF extraction library**: PyPDF2, pdfplumber (Python), PDFBox (Java), v.v.
- **Text cleaning**: Regex, whitespace normalize, encoding handling.
- **AI service integration**: REST API call đến LLM (OpenAI, Anthropic, local model, v.v.).
  - Rate limit handling.
  - Retry + backoff.
  - Cost tracking (nếu dùng paid LLM).
- **Storage**: Nên lưu PDF vào cloud storage (S3, GCS) chứ không local disk (scalability, backup).
- **Monitoring**: Track job success rate, latency, cost.
- **Prompt engineering**: Design prompt tốt để AI trả lại tóm tắt chất lượng cao.
- **Caching**: Cache summary để tránh re-process lại.

---

## 5. Các luồng nghiệp vụ end-to-end quan trọng

### 5.1 Luồng: Sinh viên tìm, xem, và đăng ký workshop miễn phí

**Mô tả**: Sinh viên muốn tham dự workshop miễn phí, từ tìm kiếm đến check-in.

**Các bước**:

1. Sinh viên đăng nhập vào ứng dụng.
2. Mở tab "Workshop" → xem danh sách.
3. Lọc workshop miễn phí (price = 0).
4. Xem chi tiết một workshop quan tâm (diễn giả, nội dung, sơ đồ phòng, tóm tắt AI).
5. Nhấp "Đăng ký" → hệ thống xác nhận, phát hành QR.
6. Sinh viên nhận thông báo xác nhận (email, push).
7. Khi đến sự kiện, quét QR để check-in.

**Các thực thể liên quan**: Workshop, Student, Registration, QRToken, Notification.

**Các điểm cần lưu ý**:

- Capacity control: tránh overbooking.
- Realtime availability: số chỗ cập nhật realtime.
- Notification reliability: email/push phải gửi được.
- QR generation: phải unique, không reuse.

---

### 5.2 Luồng: Sinh viên đăng ký workshop có thu phí

**Mô tả**: Sinh viên đăng ký workshop có phí (ví dụ: workshop liên hoan từ công ty).

**Các bước**:

1. Sinh viên chọn workshop có phí.
2. Nhấp "Thanh toán & Đăng ký" → chuyển hướng đến trang thanh toán.
3. Chọn phương thức (VNPay, Momo, v.v.).
4. Hoàn thành thanh toán.
5. Cổng thanh toán gửi webhook về hệ thống.
6. Hệ thống xác nhận, tạo Registration, phát hành QR.
7. Sinh viên nhận thông báo + QR.
8. Quét QR để check-in.

**Các thực thể liên quan**: Workshop, Student, Payment, Registration, QRToken, Notification.

**Các điểm cần lưu ý**:

- Idempotency: webhook có thể gửi lại.
- Webhook signature verification: xác thực từ cổng thanh toán.
- Refund handling: nếu workshop bị hủy.
- Payment reconciliation: so sánh trạng thái với cổng thanh toán.
- Capacity control: đảm bảo không overbooking ngay cả với payment delay.

---

### 5.3 Luồng: Sinh viên check-in tại sự kiện

**Mô tả**: Sinh viên đến sự kiện, check-in bằng QR.

**Các bước**:

1. Sinh viên đến phòng workshop.
2. Approach điểm check-in, xuất trình QR (trên phone hoặc in).
3. Staff quét QR bằng mobile app.
4. App validate QR, record check-in.
5. Hiển thị "✓ Check-in thành công".
6. (Optional) Sinh viên nhận thông báo hoặc kỷ niệm chứng chỉ.

**Các thực thể liên quan**: Registration, QRToken, CheckInRecord, Staff, Notification.

**Các điểm cần lưu ý**:

- QR idempotency: quét lại không tạo duplicate.
- Offline support: không được mất check-in khi mất mạng.
- Sync after recovery: dữ liệu offline sync lên khi online.
- Conflict resolution: nếu sinh viên check-in offline + online lần lượt.
- Latency: response phải nhanh (staff quét xong phải nhanh).

---

### 5.4 Luồng: Check-in offline rồi đồng bộ

**Mô tả**: Staff check-in offline khi mất mạng, sau đó sync dữ liệu.

**Các bước**:

1. Staff quét QR khi offline.
2. App lưu vào local DB.
3. Hiển thị "✓ Check-in (sẽ đồng bộ khi có mạng)".
4. Staff tiếp tục quét QR các sinh viên khác.
5. Khi network khôi phục, app detect → auto sync.
6. App gửi tất cả pending check-ins lên server (batch).
7. Server validate, create CheckInRecord, detect duplicate.
8. App cập nhật sync status, display result.

**Các thực thể liên quan**: LocalCheckInRecord, CheckInRecord, SyncLog.

**Các điểm cần lưu ý**:

- Duplicate detection: server check xem record đã tồn tại không.
- Batch sync: gửi toàn bộ pending cùng lúc.
- Idempotency key: mỗi check-in có unique ID để server detect duplicate.
- Conflict resolution: nếu data mâu thuẫn, cách xử lý.
- Retry logic: exponential backoff.
- Local DB cleanup: xoá old data sau khi sync.

---

### 5.5 Luồng: Ban tổ chức thay đổi phòng/giờ workshop đã có đăng ký

**Mô tả**: Ban tổ chức cần thay phòng hoặc giờ workshop vì tình huống (phòng bị hỏng, conflict với sự kiện khác).

**Các bước**:

1. Ban tổ chức mở workshop, nhấp "Sửa".
2. Thay đổi phòng hoặc giờ.
3. Hệ thống validate (check phòng có conflict không).
4. Hệ thống detect thay đổi quan trọng → publish event "workshop_changed".
5. Notification service nhận event → gửi thông báo đến tất cả sinh viên đã đăng ký:
   - "Workshop '[Name]' đã thay đổi phòng từ [Old] sang [New]" hoặc "... thay đổi giờ từ [Old] sang [New]".
6. Sinh viên nhận thông báo → có cơ hội hủy đăng ký nếu không thể.

**Các thực thể liên quan**: Workshop, Registration, Notification, NotificationLog.

**Các điểm cần lưu ý**:

- Broadcast notification: gửi đến tất cả registered students.
- Notification timing: gửi ngay, không delay.
- Audit trail: ghi lại ai sửa, lúc nào, sửa gì.
- Hủy đăng ký: có thể sinh viên hủy sau khi thấy thay đổi.

---

### 5.6 Luồng: Ban tổ chức hủy workshop

**Mô tả**: Ban tổ chức quyết định hủy workshop.

**Các bước**:

1. Ban tổ chức mở workshop, nhấp "Hủy Workshop".
2. Xác nhận hủy (nhập lý do nếu cần).
3. Hệ thống:
   - Update status workshop = CANCELLED.
   - Query tất cả Registration cho workshop này.
   - Nếu có phí, trigger refund request → payment gateway.
   - Publish event "workshop_cancelled" → notification service.
4. Notification service gửi thông báo đến tất cả sinh viên:
   - "Workshop '[Name]' đã bị hủy. Lý do: [Reason]. Tiền sẽ hoàn lại trong [N] ngày."
5. Refund service xử lý refund (async).

**Các thực thể liên quan**: Workshop, Registration, Payment, Refund, Notification.

**Các điểm cần lưu ý**:

- Refund policy: full, partial, hay no refund?
- Refund delay: bao lâu thì hoàn tiền?
- Notification: thông báo phải rõ ràng, có hướng dẫn claim refund.
- Audit log: ghi rõ ai hủy, lý do, lúc nào.
- Data retention: giữ workshop record để audit.

---

### 5.7 Luồng: Tải PDF và sinh tóm tắt bằng AI

**Mô tả**: Ban tổ chức tải PDF → AI tóm tắt → hiển thị trên trang workshop.

**Các bước**:

1. Ban tổ chức tạo hoặc sửa workshop, tải file PDF.
2. Hệ thống validate file (type, size).
3. Lưu file vào storage.
4. Publish event "pdf_uploaded" → async job queue.
5. Worker:
   - Tải PDF từ storage.
   - Extract text (PDF parsing).
   - Clean text.
   - Gửi đến LLM API: prompt tóm tắt.
   - Nhận kết quả → lưu vào AISummary (status=DONE).
6. Sinh viên xem chi tiết workshop → hiển thị AI summary.

**Các thực thể liên quan**: WorkshopFile, AISummary, LLM Service.

**Các điểm cần lưu ý**:

- Async processing: không block request.
- Error handling: PDF parsing fail, LLM timeout, v.v.
- Caching: cache summary để tránh re-process.
- Manual override: ban tổ chức có thể edit summary sau.
- Retry logic: nếu LLM fail, retry sau.
- Cost tracking: nếu dùng paid LLM.

---

## 6. Các thực thể / dữ liệu cốt lõi cần quản lý

### 6.1 Workshop

- **Attributes**: id, name, description, speaker_id, start_time, end_time, room_id, capacity, price, category, status (DRAFT/PUBLISHED/CANCELLED), created_at, updated_at, created_by.
- **Relationships**: 1 Speaker, 1 Room, N Registrations, N CheckInRecords, 1 WorkshopFile (optional), 1 AISummary (optional).

### 6.2 Speaker (Diễn giả)

- **Attributes**: id, name, bio, image_url, email, phone.

### 6.3 Room (Phòng)

- **Attributes**: id, name, capacity, location, floor, building.

### 6.4 Student (Sinh viên)

- **Attributes**: id, email, name, phone, student_id, notification_preferences (channels, is_active).

### 6.5 Registration (Đăng ký)

- **Attributes**: id, student_id, workshop_id, registration_time, status (REGISTERED/CANCELLED), qr_token, check_in_status (PENDING/CHECKED_IN), check_in_time, payment_status (PENDING/PAID/REFUNDED).
- **Relationships**: 1 Student, 1 Workshop, 1 Payment (nếu có phí), 1 CheckInRecord.

### 6.6 Payment (Thanh toán)

- **Attributes**: id, student_id, workshop_id, amount, currency, payment_method, transaction_id (từ gateway), status (PENDING/SUCCESS/FAILED/REFUNDED), created_at, updated_at.

### 6.7 CheckInRecord (Ghi nhận check-in)

- **Attributes**: id, student_id, workshop_id, check_in_time, staff_id, latitude (optional), longitude (optional).

### 6.8 Notification (Thông báo)

- **Attributes**: id, student_id, workshop_id, event_type (REGISTRATION_CONFIRMED, WORKSHOP_CHANGED, WORKSHOP_CANCELLED, REMINDER, v.v.), channels (list), status (SENT/FAILED), created_at.

### 6.9 WorkshopFile (Tài liệu PDF)

- **Attributes**: id, workshop_id, file_type, file_url, file_size, upload_at, uploader_id.

### 6.10 AISummary (Tóm tắt AI)

- **Attributes**: id, workshop_id, status (PENDING/PROCESSING/DONE/ERROR), summary_text, error_msg, created_at, updated_at.

### 6.11 NotificationPreference (Tùy chọn thông báo)

- **Attributes**: student_id, email, phone, telegram_id, enabled_channels (list), is_active, updated_at.

### 6.12 Staff (Nhân sự check-in)

- **Attributes**: id, name, email, phone, role (CHECK_IN_STAFF, ORGANIZER, ADMIN).

### 6.13 AuditLog (Lịch sử thay đổi)

- **Attributes**: id, entity_type (Workshop, Registration, Payment, v.v.), entity_id, action (CREATE, UPDATE, DELETE), changed_fields (list), changed_by, changed_at.

---

## 7. Các yêu cầu phi chức năng và ràng buộc

### 7.1 Concurrency & Data Consistency

**Overbooking prevention**:

- Khi đăng ký, phải đảm bảo số đã đăng ký <= capacity.
- Cơ chế: transaction + row lock, hoặc distributed lock (Redis).
- **High traffic scenario**: Nếu 1000 sinh viên cùng lúc đăng ký, hệ thống phải reject những người vượt quá capacity, không cho phép overbooking.

**Idempotency**:

- Đăng ký workshop: nếu bấm 2 lần nhanh, chỉ tạo 1 registration.
- Thanh toán: nếu webhook gửi lại, không xử lý lại.
- Check-in: nếu quét 2 lần, chỉ record 1 check-in.
- **Mechanism**: Client-side idempotency key (UUID), server check key này: nếu tồn tại, return kết quả cũ.

### 7.2 Realtime Updates

**Seat availability**:

- Khi sinh viên xem danh sách hoặc chi tiết workshop, số chỗ còn lại phải realtime.
- **Mechanism**: WebSocket push, Server-Sent Events (SSE), hoặc polling (1-5s).
- **Performance**: Nếu 10k+ sinh viên, broadcast push có thể overwhelming. Cần optimize (batch updates, compression, v.v.).

**Notification broadcast**:

- Khi workshop change, phải thông báo tất cả registered students ngay.
- **Mechanism**: Event-driven, notification service consume event, gửi async.

### 7.3 Offline-first / Resilience

**Mobile app offline check-in**:

- App phải hoạt động ngay cả khi mất mạng.
- Dữ liệu offline sync lên khi online.
- **Conflict resolution**: Nếu sinh viên check-in offline + online, server detect duplicate (dùng idempotency key).

**Notification reliability**:

- Email/push có thể fail. Hệ thống phải retry (exponential backoff).
- Nên có fallback (ví dụ: nếu email fail, thử SMS).
- Đừng gửi đồng bộ (có thể timeout). Dùng queue + async worker.

### 7.4 Payment & Financial

**Payment security**:

- Webhook signature verification: xác thực request từ payment gateway (HMAC-SHA256, v.v.).
- PCI compliance: không store raw credit card data, để payment gateway xử lý.
- Encrypted connection: HTTPS everywhere.

**Reconciliation**:

- Hàng ngày/giờ, batch job so sánh trạng thái payment trên hệ thống vs payment gateway.
- Phát hiện anomaly (ví dụ: payment success trên gateway nhưng PENDING trên hệ thống → manual intervention).

**Refund policy**:

- Define rõ: full refund, partial refund, no refund?
- Audit trail: ghi lại mỗi refund (who, when, why).

### 7.5 Notification Channel Extensibility

**Current channels**: Email, Push Notification, SMS.

**Future channels**: Telegram, WhatsApp, Discord, v.v.

**Design pattern**:

- Channel abstraction: interface INotificationChannel → implementations (EmailChannel, PushChannel, SMSChannel, TelegramChannel, v.v.).
- Configuration: store channel preferences per student (opt-in/opt-out).
- Template engine: reusable templates cho mỗi event type (REGISTRATION_CONFIRMED, WORKSHOP_CHANGED, v.v.) × channel.
- No hard-coding: thêm channel mới không cần modify core logic.

### 7.6 Audit & Compliance

**Audit log**:

- Ghi lại tất cả thay đổi (CREATE, UPDATE, DELETE).
- Fields: entity type, entity ID, action, old value, new value, changed by, changed at.
- **Retention**: Giữ lâu dài (ví dụ: 3 năm) cho compliance.

**Data privacy** (GDPR, local regulations):

- Sinh viên có quyền:
  - Xem dữ liệu cá nhân của họ.
  - Yêu cầu xoá dữ liệu (right to be forgotten).
  - Opt-in/opt-out thông báo.
- System phải hỗ trợ export dữ liệu cá nhân, anonymization, etc.

### 7.7 Performance & Scalability

**Database**:

- Chỉ số (index): workshop ID, student ID, registration status (để query nhanh).
- Partitioning: nếu bảng rất lớn (millions rows), có thể partition by workshop_id hoặc date.
- Read replicas: distribute read queries.

**Caching**:

- Workshop list: cache ngắn hạn (5-10 phút), invalidate khi có update.
- AI summary: cache lâu dài (không invalidate nếu workshop không change).
- Student notification preferences: cache (5 phút) để avoid frequent DB hit.

**Batch processing**:

- Thống kê: calculate batch (hourly) chứ không realtime.
- Refund: process batch (daily).
- Notification: send batch (không gửi từng cái).

**API rate limiting**:

- Prevent abuse: limit X requests / Y seconds per user.
- Graceful degradation: nếu overload, queue request, return 429 (Too Many Requests).

### 7.8 Monitoring & Observability

**Metrics**:

- Registration success rate.
- Payment success rate.
- Check-in latency.
- Notification delivery rate.
- AI summary generation latency & error rate.
- API response time (percentile: p50, p95, p99).

**Logging**:

- Log tất cả error, warning.
- Include context (user ID, workshop ID, transaction ID, v.v.) để debugging.
- Centralize logs (ELK stack, CloudWatch, v.v.).

**Tracing**:

- Distributed tracing (Jaeger, Datadog, v.v.) để track request flow qua multiple services.

**Alerting**:

- Alert nếu payment gateway timeout, AI service down, etc.

### 7.9 Capacity & Load

**Expected load** (tuỳ context, nhưng assume):

- N workshops (ví dụ: 50-100).
- M students (ví dụ: 1000-10000).
- Peak: registration spike khi workshop công bố (có thể 10-100 request/s).
- Check-in spike: trước khi workshop khai mạc (100-1000 check-in/minute).

**System must handle**:

- Concurrent registrations (thousands/minute).
- Concurrent check-ins (hundreds/minute).
- Realtime updates (websocket broadcast).

---

## 8. Các điểm cần phân tích sâu ở bước thiết kế phần mềm

### 8.1 Domain Boundaries & Bounded Contexts

**Potential bounded contexts**:

1. **Workshop Context**: Quản lý thông tin workshop, speaker, room booking.
2. **Registration Context**: Quản lý đăng ký, capacity control, ticket/QR.
3. **Payment Context**: Xử lý thanh toán, refund, reconciliation.
4. **Check-in Context**: Ghi nhận check-in, offline-first, sync.
5. **Notification Context**: Gửi thông báo qua multiple channels.
6. **AI Context**: Xử lý PDF, tóm tắt AI.
7. **Reporting Context**: Thống kê, analytics.

**Cần quyết định**:

- Các context này có độc lập không, hay có dependencies?
- Dữ liệu share giữa các context?
- Communication pattern (event-driven, RPC, v.v.)?

### 8.2 Event-driven vs Request-driven

**Scenarios phù hợp với event-driven**:

- Workshop change → broadcast notification.
- Registration confirmed → send confirmation email.
- Refund success → update payment status, send notification.
- Check-in recorded → update capacity.
- AI summary done → notify admin (optional).

**Cân nhắc**:

- Event-driven → eventual consistency, harder to debug, nhưng scalable + resilient.
- Request-driven → immediate consistency, easier to debug, nhưng tightly coupled.

**Suggestion**:

- Dùng event-driven cho notification, refund, async jobs.
- Dùng request-driven cho capacity control, validation (cần immediate).

### 8.3 Queue / Background Job Management

**Jobs cần async**:

- Gửi email/push.
- Xử lý PDF → tóm tắt AI.
- Refund.
- Sync check-in offline.
- Batch reporting.

**Technology options**:

- RabbitMQ, Apache Kafka, AWS SQS, Google Cloud Tasks, Redis Queue, Celery, v.v.

**Cân nhắc**:

- Throughput, latency, reliability, cost, operational complexity.
- Nên standardize trên 1-2 tool.

### 8.4 Transaction Boundaries

**Strong transaction (ACID required)**:

- Capacity control: `UPDATE workshop SET registered_count = registered_count + 1 WHERE id = ? AND registered_count < capacity`.
- Payment + Registration: atomicity.
- Check-in idempotency: check duplicate + insert (transaction).

**Eventual consistency (okay)**:

- Notification gửi delayed.
- AI summary generation.
- Check-in sync offline.
- Reporting data stale (1-5 phút).

**Technology**:

- Relational DB transactions (PostgreSQL, MySQL).
- Distributed transaction (saga pattern): nếu spanning multiple services.

### 8.5 Realtime Seat Availability

**Approaches**:

1. **Polling**: Client poll server mỗi N giây. Simple, nhưng latency cao (N up to seconds).
2. **WebSocket**: Server push khi capacity change. Real-time, nhưng connection management complex.
3. **Server-Sent Events (SSE)**: Unidirectional push từ server. Simpler than WebSocket, nhưng không support IE.
4. **Hybrid**: Poll + WebSocket fallback.

**Optimization**:

- Batch updates: không push individual change, batch mỗi 100ms (ví dụ).
- Compress: delta updates (chỉ send thay đổi, không full data).
- Unsubscribe: client không subscribed workshop không cần update.

### 8.6 Offline Check-in Sync

**Challenges**:

- Duplicate detection: sinh viên check-in offline + online.
- Conflict resolution: nếu dữ liệu mâu thuẫn.
- Sync algorithm: all pending, incremental, v.v.
- State machine: local state vs server state.

**Design pattern**:

- Idempotency key: mỗi check-in có unique ID.
- Server-side dedup: check xem record tồn tại không (composite key: student_id + workshop_id + timestamp approximate).
- Last-write-wins: nếu conflict, dùng timestamp.
- Manual resolution: nếu complex conflict, flag for manual review.

### 8.7 Payment Flow & Webhook Handling

**Architecture**:

```
Student → Payment UI → Payment Gateway → Webhook callback → Server
                                        └─→ Browser redirect
```

**Challenges**:

- Webhook reliability: có thể gửi lại, delay, missing.
- Browser redirect timing: user redirect trước khi webhook arrive.
- Idempotency: không xử lý duplicate webhook.

**Recommendation**:

- Webhook xác thực signature (HMAC).
- Idempotency key: generate on client, server check.
- Polling fallback: nếu webhook chậm, poll gateway every N giây (up to M lần).
- State machine: payment state (PENDING → SUCCESS/FAILED/REFUNDED).
- Log webhook: ghi chi tiết mỗi webhook (timestamp, payload, signature, kết quả xử lý).

### 8.8 Notification Plugin Architecture

**Goal**: Dễ thêm channel mới.

**Design**:

```
NotificationService
  ├─ EmailChannel (sendgrid, ses, smtp)
  ├─ PushChannel (firebase, apns)
  ├─ SMSChannel (twilio, sns)
  ├─ TelegramChannel (telegram bot api)
  └─ (future) WhatsAppChannel, DiscordChannel, ...

ChannelRegistry (dynamic load channels)
ChannelTemplate (template per event type × channel)
ChannelPreference (user preferences: enabled channels)
```

**Implementation**:

- Interface-based design (IChannel, ITemplate, v.v.).
- Config-driven: read channel config từ file/DB, dynamic instantiate.
- Template engine: Jinja, Handlebars, v.v. để render template.

### 8.9 AI Pipeline Robustness

**Failure scenarios**:

- PDF parsing fail (corrupt file, lạ format).
- LLM timeout (processing slow, rate limit).
- LLM error (invalid input, quota exceeded).
- Storage failure (save file, retrieve file).

**Handling**:

- Retry logic: exponential backoff (1s, 2s, 4s, ..., max 60s).
- Fallback: nếu fail N lần, log + alert admin, display "tóm tắt đang được chuẩn bị".
- Partial success: extract text OK nhưng LLM fail → save extracted text (fallback for student).
- Monitoring: track job success/failure rate, latency, cost.

### 8.10 Logging & Tracing

**What to log**:

- API requests/responses (method, path, status, latency, user_id).
- Database queries (query, params, latency, rows affected).
- External service calls (service, endpoint, status, latency).
- Business events (registration, payment, check-in, notification).
- Errors & exceptions (stack trace, context).

**Structured logging**:

- JSON format: {timestamp, level, service, user_id, workshop_id, message, ...}.
- Centralize: ELK (Elasticsearch + Logstash + Kibana), Datadog, CloudWatch, v.v.

**Distributed tracing**:

- Trace ID: attach to mỗi request, pass đến external services.
- Span: mỗi operation (DB query, API call, function) = 1 span.
- Tool: Jaeger, Zipkin, Datadog, v.v.

---

## 9. Giả định và câu hỏi mở

### 9.1 Giả định hiện tại

1. **Số lượng workshop**: 50-200 workshops / sự kiện.
2. **Số lượng sinh viên**: 1000-10000 sinh viên / sự kiện.
3. **Thời gian sự kiện**: 3-7 ngày.
4. **Peak traffic**: 100-1000 requests/s khi registration open, 100-1000 check-ins/minute.
5. **Phòng**: 5-20 phòng khác nhau, mỗi phòng có capacity 50-500.
6. **Giờ workshop**: không overlap trong cùng phòng.
7. **Thanh toán**: Nếu có, dùng cổng thanh toán third-party (VNPay, Momo, v.v.), không tự xây.
8. **AI service**: Dùng LLM external (OpenAI, Anthropic, local model, v.v.).
9. **Notification**: Email, push, SMS (và có thể extend).
10. **Staff**: Có dedicated check-in staff (không self-check-in).

### 9.2 Câu hỏi cần làm rõ với stakeholder

1. **Workshop duration**: Workshop có thể overlay giờ không (ví dụ: cùng lúc 2 workshop trong 2 phòng khác)?
   - **Impact**: Room booking conflict detection, capacity planning.

2. **No-show policy**: Nếu sinh viên đăng ký nhưng không check-in, có penalty không?
   - **Impact**: Refund, waitlist, trust score.

3. **Waitlist**: Nếu workshop full, có support waitlist không?
   - **Impact**: Auto-notification khi có chỗ trống, queue management.

4. **Cancellation deadline**: Sinh viên hủy đăng ký được tới khi nào? Full refund hay partial?
   - **Impact**: Refund policy, cutoff date.

5. **Multiple registration**: Sinh viên có thể đăng ký multiple workshop cùng giờ không?
   - **Impact**: Schedule conflict detection, validation.

6. **QR validity**: QR code valid bao lâu? Chỉ hôm workshop, hay hôm trước, hôm sau?
   - **Impact**: QR expiry, validation logic.

7. **AI summary language**: Summary bằng tiếng Việt, hay English, hay auto-detect?
   - **Impact**: Prompt engineering, model capability.

8. **Refund method**: Hoàn tiền back to original payment method, hay account credit?
   - **Impact**: Refund flow, user expectation.

9. **Mobile app**: Dedicated app, hay web-responsive? Offline-first priority?
   - **Impact**: Tech stack, dev effort.

10. **Analytics**: Cần realtime dashboard, hay batch report hàng ngày?
    - **Impact**: Infrastructure (OLTP vs OLAP), performance.

11. **Multi-event**: Hệ thống handle 1 sự kiện tại 1 thời điểm, hay multiple parallel events?
    - **Impact**: Data isolation, tenancy, scalability.

12. **Authentication**: Dùng LDAP/Active Directory nhà trường, hay local account?
    - **Impact**: Auth integration, user provisioning.

---

## 10. Kết luận

### 10.1 Tóm tắt phạm vi chức năng

UniHub Workshop cung cấp một nền tảng toàn diện quản lý workshop, từ quản lý tạo workshop (ban tổ chức), đăng ký (sinh viên), check-in (nhân sự), tới hỗ trợ thông báo và AI tóm tắt.

**7 nhóm chức năng chính**:

1. Sinh viên: xem, đăng ký, quản lý vé.
2. Ban tổ chức: tạo, cập nhật, hủy, thống kê.
3. Check-in: quét QR, ghi nhận tham dự, offline-first.
4. Thanh toán: hỗ trợ workshop có phí.
5. Thông báo: gửi qua multiple channel, dễ mở rộng.
6. AI: tóm tắt PDF tự động.
7. Reporting: dashboard, thống kê, audit log.

### 10.2 Các hướng kỹ thuật lớn để phân tích tiếp

#### **1. Kiến trúc Microservice vs Monolith**

- **Option A**: Monolith (đơn giản, nhanh develop).
  - Pro: dễ deploy, transaction mạnh, debugging đơn giản.
  - Con: khó scale, couples tight.
- **Option B**: Microservice (complex, nhưng scalable).
  - Pro: scale riêng từng service, team độc lập.
  - Con: distributed transaction complexity, operational overhead.
- **Recommendation**: Start monolith, refactor to microservice khi cần scale (nếu single service bị bottleneck).

#### **2. Event-driven Architecture**

- Trigger event cho: registration, payment, check-in, notification, AI job.
- Benefits: decoupling, scalability, retry logic.
- Tool: event bus (in-process cho monolith, message broker cho distributed).

#### **3. Realtime Updates (WebSocket / SSE)**

- Need: realtime seat availability, realtime check-in status.
- Option: WebSocket, SSE, polling, or hybrid.
- Trade-off: latency vs complexity vs resource usage.

#### **4. Offline-first Mobile App**

- Need: check-in staff able to work offline.
- Tech: SQLite, Realm, sync logic, conflict resolution.
- Challenge: data consistency, sync reliability.

#### **5. Payment Integration**

- Need: integrate payment gateway (VNPay, Momo, v.v.).
- Challenge: webhook handling, idempotency, reconciliation.
- Pattern: event-driven payment confirmation.

#### **6. Notification Plugin System**

- Need: support multiple channels (email, push, SMS, Telegram, ...).
- Architecture: channel abstraction, registry, template engine.
- Benefit: easy to extend, no core logic modification.

#### **7. AI / LLM Integration**

- Need: async PDF processing, text extraction, summarization.
- Challenge: error handling, retry, cost, latency.
- Pattern: queue-based job, webhook/polling for result.

#### **8. Database Design & Optimization**

- Considerations: partitioning, indexing, caching, read replicas.
- Transaction boundaries: ACID where needed, eventual consistency elsewhere.
- Backup & recovery strategy.

#### **9. Monitoring & Observability**

- Metrics: registration rate, payment success rate, check-in latency, notification delivery rate, AI summary latency.
- Logging: centralized, structured, contextual.
- Tracing: distributed tracing for cross-service request flow.
- Alerting: proactive alerts for SLA violation.

#### **10. Testing Strategy**

- Unit tests: business logic, validators.
- Integration tests: DB, payment gateway mock, email service mock.
- Load tests: peak traffic scenario (registration spike, check-in spike).
- E2E tests: critical user journeys.

### 10.3 Bước tiếp theo

1. **Use case analysis**: Chi tiết hóa từng use case, xác định pre/post conditions, alternative flows.
2. **Domain modeling**: Identify domain entities, value objects, aggregates, bounded contexts.
3. **C4 diagram**: Draw context, container, component levels.
4. **Technology selection**: Choose tech stack (language, framework, DB, message broker, v.v.).
5. **Architecture decision**: Monolith vs microservice, sync vs async, event-driven design.
6. **API design**: Define REST/gRPC APIs, versioning strategy, error handling.
7. **Security analysis**: Authentication, authorization, data encryption, PCI compliance.
8. **Operational planning**: Deployment, scaling, monitoring, incident response.
9. **MVP scope**: Prioritize features for first release, defer nice-to-have.

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-24  
**Author**: Architecture Analysis Team  
**Status**: Ready for Architecture Design Phase
