# Đặc tả: Check-in QR online/offline

## Mô tả

Tính năng check-in cho phép nhân sự check-in quét QR tại cửa phòng. Hệ thống hỗ trợ check-in online khi có mạng và offline queue khi mất mạng, sau đó batch sync về server với dedupe/conflict handling.

## Luồng chính

### Check-in online

1. Staff đăng nhập Check-in Mobile App.
2. Staff chọn workshop/phòng được phân công.
3. Staff quét QR của sinh viên.
4. Mobile App gửi `POST /checkins` với `qr_token`, `workshop_id`, `idempotency_key`.
5. Backend xác thực role CHECKIN_STAFF/ORGANIZER/ADMIN.
6. Check-in Module validate:
   - QR tồn tại và ACTIVE.
   - Registration CONFIRMED.
   - Workshop đúng và trong khung giờ cho phép check-in.
   - QR chưa được dùng.
7. Backend tạo checkin và update QR USED trong transaction.
8. App hiển thị check-in thành công.

### Check-in offline

1. Staff quét QR khi mất mạng.
2. App validate offline cơ bản bằng preloaded cache hoặc format token.
3. App lưu local event gồm `local_id`, `device_id`, `qr_token`, `workshop_id`, `checked_in_at`, `staff_id`, `sync_status=PENDING_SYNC`.
4. App hiển thị check-in tạm thời.
5. Khi có mạng, app gửi batch pending events lên `POST /checkins/offline-sync`.
6. Backend xử lý từng event idempotent theo `device_id + local_id`.
7. Event hợp lệ tạo checkin; event trùng/sai ghi sync log conflict.
8. App cập nhật từng local record thành SYNCED, CONFLICT hoặc FAILED.

## Kịch bản lỗi

| Lỗi | Cách hệ thống phản ứng |
| --- | --- |
| QR không tồn tại | Online: trả invalid QR. Offline: lưu NEEDS_REVIEW hoặc từ chối tùy policy. |
| QR đã dùng | Trả ALREADY_CHECKED_IN, kèm thời điểm nếu được phép hiển thị. |
| QR đúng nhưng sai workshop | Trả WRONG_WORKSHOP hoặc conflict khi sync. |
| Workshop đã hủy/kết thúc | Không tạo checkin, trả lỗi rõ. |
| Mobile mất mạng giữa batch sync | App giữ pending events; retry cùng local_id an toàn. |
| Cùng QR được scan offline ở nhiều thiết bị | Backend unique `qr_token_id` chỉ cho một checkin thành công; các event sau conflict. |
| Local storage lỗi | App không được hiển thị check-in tạm thời nếu không lưu được event. |
| Staff không có quyền | Trả 403 và không scan/sync. |

## Ràng buộc

- Một QR chỉ check-in thành công một lần.
- Offline validation chỉ là tạm thời; backend validation khi sync là quyết định cuối cùng.
- Local queue phải lưu bền vững, không chỉ giữ trong memory.
- Batch sync phải trả kết quả từng local event.
- Sync API phải idempotent.
- Check-in thành công và update QR USED phải atomic.
- App nên preload danh sách QR/registration hợp lệ trước sự kiện để cải thiện offline UX.

## Tiêu chí chấp nhận

- [ ] Given QR ACTIVE hợp lệ, When staff scan online, Then checkin được tạo và QR chuyển USED.
- [ ] Given QR đã USED, When scan lại, Then không tạo checkin mới.
- [ ] Given mất mạng, When staff scan QR, Then local event được lưu PENDING_SYNC.
- [ ] Given có mạng lại, When app sync batch, Then mỗi local_id nhận SYNCED/CONFLICT/FAILED.
- [ ] Given sync retry cùng local_id, When backend nhận lại, Then trả kết quả cũ hoặc no-op.
- [ ] Given cùng QR scan offline trên hai thiết bị, When sync, Then chỉ một thiết bị được SYNCED.
- [ ] Given staff sai role, When scan hoặc sync, Then nhận 403.
