# Workshop: Xây dựng Ứng dụng Mobile Offline-first với React Native

## 1. Giới thiệu chung

Workshop **“Xây dựng Ứng dụng Mobile Offline-first với React Native”** được thiết kế dành cho sinh viên, lập trình viên mới bắt đầu, hoặc các nhóm đang phát triển ứng dụng mobile cần hoạt động ổn định trong điều kiện mạng không liên tục.

Trong workshop này, người tham gia sẽ được tìm hiểu cách xây dựng một ứng dụng mobile có khả năng lưu dữ liệu cục bộ, xử lý tác vụ khi không có Internet và đồng bộ dữ liệu khi kết nối mạng được khôi phục.

---

## 2. Mục tiêu workshop

Sau khi hoàn thành workshop, người tham gia có thể:

- Hiểu khái niệm **offline-first** trong phát triển ứng dụng mobile.
- Biết cách tổ chức cấu trúc dự án React Native/Expo.
- Sử dụng lưu trữ cục bộ để lưu dữ liệu tạm thời.
- Xây dựng luồng xử lý khi thiết bị mất kết nối mạng.
- Thiết kế cơ chế đồng bộ dữ liệu giữa mobile app và backend.
- Áp dụng kiến thức vào các bài toán thực tế như check-in sự kiện, quản lý điểm danh, ghi nhận biểu mẫu hoặc quản lý công việc tại hiện trường.

---

## 3. Đối tượng tham gia

Workshop phù hợp với:

- Sinh viên ngành Công nghệ Thông tin hoặc Kỹ thuật phần mềm.
- Lập trình viên frontend muốn tìm hiểu phát triển ứng dụng mobile.
- Nhóm dự án đang xây dựng ứng dụng cần hỗ trợ chế độ offline.
- Người đã có kiến thức cơ bản về JavaScript hoặc TypeScript.

---

## 4. Nội dung chính

### Phần 1: Tổng quan về Offline-first

- Offline-first là gì?
- Vì sao ứng dụng mobile cần hỗ trợ offline?
- Các tình huống thực tế thường gặp:
  - Mất kết nối Internet.
  - Kết nối yếu hoặc không ổn định.
  - Người dùng thao tác liên tục khi không có mạng.

### Phần 2: Thiết lập dự án React Native với Expo

- Tạo project Expo.
- Cấu trúc thư mục cơ bản.
- Cài đặt các thư viện cần thiết.
- Tổ chức màn hình, service và store.

### Phần 3: Lưu trữ dữ liệu cục bộ

- Giới thiệu các lựa chọn lưu trữ:
  - AsyncStorage.
  - SQLite.
  - SecureStore.
- Thiết kế dữ liệu lưu offline.
- Thực hành lưu và đọc dữ liệu từ thiết bị.

### Phần 4: Xử lý trạng thái mạng

- Kiểm tra trạng thái kết nối Internet.
- Hiển thị cảnh báo khi mất mạng.
- Cho phép người dùng tiếp tục thao tác khi offline.
- Ghi nhận các tác vụ cần đồng bộ sau.

### Phần 5: Đồng bộ dữ liệu với backend

- Thiết kế hàng đợi đồng bộ.
- Gửi dữ liệu lên server khi có mạng.
- Xử lý lỗi khi đồng bộ thất bại.
- Tránh gửi trùng dữ liệu.
- Cập nhật trạng thái sau khi đồng bộ thành công.

### Phần 6: Mini Project thực hành

Người tham gia sẽ xây dựng một ứng dụng demo đơn giản:

**Ứng dụng Check-in Workshop**

Chức năng chính:

- Đăng nhập nhân viên check-in.
- Xem danh sách buổi workshop.
- Quét mã QR người tham gia.
- Lưu lượt check-in khi offline.
- Đồng bộ dữ liệu check-in khi có mạng.

---

## 5. Hình thức tổ chức

- **Thời lượng:** 1 buổi, khoảng 3–4 giờ.
- **Hình thức:** Trực tiếp hoặc online.
- **Phương pháp:** Lý thuyết ngắn gọn kết hợp thực hành.
- **Yêu cầu thiết bị:** Laptop cá nhân, điện thoại hoặc trình giả lập mobile.

---

## 6. Công cụ và công nghệ sử dụng

- React Native.
- Expo.
- TypeScript.
- Expo SQLite hoặc AsyncStorage.
- NetInfo.
- REST API.
- Git/GitHub.

---

## 7. Kết quả đầu ra

Sau workshop, người tham gia sẽ có:

- Một project mobile demo có hỗ trợ offline.
- Kiến thức nền tảng để triển khai offline-first trong dự án thật.
- Hiểu rõ cách xử lý dữ liệu cục bộ và đồng bộ dữ liệu.
- Khả năng mở rộng demo thành các hệ thống lớn hơn như điểm danh lớp học, check-in sự kiện hoặc quản lý tác vụ nội bộ.

---

## 8. Lợi ích khi tham gia

Workshop giúp người tham gia không chỉ biết cách xây dựng giao diện mobile, mà còn hiểu cách thiết kế trải nghiệm người dùng ổn định trong các điều kiện thực tế. Đây là kỹ năng quan trọng khi phát triển các ứng dụng phục vụ sự kiện, giáo dục, logistics, khảo sát hoặc vận hành ngoài hiện trường.

---

## 9. Thông tin liên hệ

- **Đơn vị tổ chức:** UniHub Team
- **Email:** contact@unihub.example
- **Địa điểm:** Trường/Trung tâm tổ chức workshop
- **Thời gian:** Sẽ được thông báo trước ngày diễn ra sự kiện

---

## 10. Kết luận

Workshop **“Xây dựng Ứng dụng Mobile Offline-first với React Native”** là cơ hội để người tham gia tiếp cận một hướng phát triển ứng dụng thực tế, hữu ích và có tính ứng dụng cao. Thông qua phần thực hành, người học có thể hiểu rõ hơn cách xây dựng một ứng dụng mobile không phụ thuộc hoàn toàn vào kết nối Internet.
