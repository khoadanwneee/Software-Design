# Đặc tả: Check-in QR online/offline

## Mô tả

Check-in dành cho mobile app. Web không còn route check-in trong luồng sử dụng hiện tại.

## Luồng online

1. Staff/Admin đăng nhập mobile.
2. Quét QR.
3. Mobile gọi `POST /api/checkins` với `qrPayload`, `workshopId`, `idempotencyKey`.
4. API xác thực role `CHECKIN_STAFF|ORGANIZER|ADMIN`.
5. API validate QR/workshop/status và tạo checkin trong transaction.
6. API cập nhật QR token sang `USED`.

## Luồng offline sync

1. Khi mất mạng, mobile lưu local event vào queue.
2. Khi có mạng, mobile gọi `POST /api/checkins/offline-sync`.
3. API xử lý từng event, trả kết quả từng `clientCheckinId`:

   * `SYNCED`
   * `DUPLICATE`
   * `CONFLICT`
   * `FAILED`
4. API ghi `offline_checkin_sync_logs` để idempotent và audit.

## API liên quan

* `GET /api/checkins/offline-cache`
* `POST /api/checkins/validate`
* `POST /api/checkins`
* `POST /api/checkins/offline-sync`

## Lỗi và xử lý

* QR không hợp lệ: `INVALID_QR`.
* Sai workshop: `WRONG_WORKSHOP`.
* QR đã dùng/không active: `ALREADY_CHECKED_IN`.
* Workshop không mở check-in: `WORKSHOP_NOT_OPEN`.

## Ràng buộc

* Một QR chỉ check-in thành công một lần.
* Sync offline phải idempotent theo device + `clientCheckinId`.
* Quyết định cuối cùng luôn ở backend khi sync.

## Tiêu chí chấp nhận

* Online check-in hợp lệ tạo checkin và cập nhật QR `USED`.
* Scan lại QR đã dùng không tạo checkin mới.
* Offline event sync được phân loại trạng thái rõ ràng theo từng item.
