Bối Cảnh
Mô hình hóa một hệ thống mô phỏng trò chơi quân đội với các đặc điểm sau:

Có ít nhất hai loại binh lính: bộ binh (infantryman) và kỵ binh (horseman).
Mỗi binh lính có thể được trang bị các loại vũ khí/giáp: khiên (shield) và kiếm (sword).
Binh lính có hai hành động chính:
int hit() – tấn công, trả về chỉ số sức mạnh tấn công tùy theo loại binh lính và trang bị.
boolean wardOff(int strength) – phòng thủ trước đòn tấn công có cường độ cho trước, trả về true nếu binh lính còn sống, false nếu đã tử trận.
Các trận chiến diễn ra cho đến khi một bên bị tiêu diệt hoàn toàn.
Phần 1 – Trang Bị Cho Binh Lính
Mẫu thiết kế áp dụng: Decorator, Proxy

1.1. Decorator Pattern
Yêu cầu thiết kế:

Sử dụng Decorator Pattern để xây dựng kiến trúc cho phép gắn nhiều loại trang bị lên một binh lính (ví dụ: bộ binh với khiên và kiếm, kỵ binh với khiên).
Vẽ class diagram thể hiện kiến trúc Decorator cho hệ thống binh lính.
Cài đặt với Java/Python
Sửa đổi cài đặt để in ra chuỗi gọi phương thức khi wardOff() hoặc hit() được kích hoạt.
Câu hỏi:

Theo Decorator Pattern, "chức năng của đối tượng trở nên phong phú hơn" – điều này có đúng trong trường hợp này không? Giải thích.
Nếu có thêm ràng buộc: một binh lính không thể mang hai trang bị cùng loại – Decorator có phải là phương pháp thích hợp để đảm bảo ràng buộc này không? Tại sao?
1.2. Proxy Pattern
Yêu cầu thiết kế:

Cải tiến thiết kế ở mục 1.1 bằng cách sử dụng Proxy Pattern: thêm một interface Soldier với các phương thức addShield() và addSword().
Dựa vào Proxy, đưa ra giải pháp đảm bảo ràng buộc "không trùng lặp trang bị" đã đặt ra ở câu 1.1.6.
Sửa đổi thiết kế để hỗ trợ việc thêm một loại trang bị hoàn toàn mới mà không phải thay đổi code hiện tại.
1.3. Trang Bị Hao Mòn
Yêu cầu thiết kế:

Thêm cơ chế hao mòn trang bị trong các trận chiến (ví dụ: shield hay sword bị giảm hiệu quả sau mỗi lần sử dụng).
Sự thay đổi này phải trong suốt với phần còn lại của chương trình – tức là code bên ngoài không cần biết trang bị đang bị hao mòn.
Cài đặt với Java/Python.
Phần 2 – Tổ Chức Quân Đội
Mẫu thiết kế áp dụng: Composite, Visitor

2.1. Composite Pattern
Chúng ta cần tổ chức các binh lính thành nhóm và đội quân với cấu trúc phân cấp:

Một đội quân (army) có thể gồm nhiều nhóm (group) binh lính.
Mỗi nhóm có thể được chia thành các nhóm con.
Mỗi nhóm hành xử như một binh lính đơn lẻ:
Sức mạnh tấn công của nhóm = tổng sức mạnh của tất cả thành viên.
Khi phòng thủ, cường độ đòn tấn công được chia đều cho mỗi thành viên trong nhóm.
Thêm trang bị cho một nhóm = thêm trang bị cho tất cả thành viên trong nhóm đó.
Yêu cầu thiết kế:

Sử dụng Composite Pattern để mở rộng thiết kế từ Phần 1, bổ sung khái niệm nhóm và quân đội.
Cài đặt với Java/Python.
2.2. Visitor Pattern
Yêu cầu thiết kế:

Sử dụng Visitor Pattern để bổ sung chức năng mới cho toàn bộ cấu trúc binh lính/quân đội mà không dùng kế thừa hay delegation trực tiếp.
Cài đặt 02 Visitor cụ thể:
DisplayVisitor: In ra danh sách tất cả các thành viên trong một quân đội (tên, loại, trang bị).
CountVisitor: Đếm số lượng bộ binh và kỵ binh hiện có trong một quân đội.
Cài đặt với Java/Python.
Phần 3 – Theo Dõi & Quản Lý Trận Chiến
Mẫu thiết kế áp dụng: Observer, Singleton, Abstract Factory

3.1. Observer Pattern
Chúng ta cần theo dõi diễn biến trận chiến theo thời gian thực:

Yêu cầu thiết kế:

Sử dụng Observer Pattern để hoàn thiện kiến trúc với hai observer:
DeathCountObserver: Hiển thị số lượng binh lính đã tử trận trong trận chiến.
DeathNotifierObserver: Hiển thị tên các binh lính đã tử trận và gửi email xin lỗi đến bạn bè của họ.
Cả hai observer phải được cập nhật mỗi khi một binh lính tử trận.
Cài đặt với Java/Python.
3.2. Singleton Pattern
Yêu cầu thiết kế:

Sử dụng Singleton Pattern để đảm bảo mỗi observer (DeathCountObserver, DeathNotifierObserver) chỉ có duy nhất một instance trong toàn bộ chương trình.
Giải thích tại sao việc giới hạn này lại có ý nghĩa trong bối cảnh theo dõi trận chiến.
3.3. Abstract Factory Pattern
Chúng ta muốn tạo các thế hệ binh lính tương thích với từng thời đại lịch sử. Ví dụ:

Thế hệ Trang Bị Cho Phép
Medieval (Trung Cổ) Kiếm, giáo, áo giáp
WorldWar (Thế Chiến) Súng trường, lựu đạn, mũ sắt
ScienceFiction (Khoa Học Viễn Tưởng) Kiếm laser, vũ khí sinh học, giáp nano
Nguyên tắc: Một binh lính thuộc thế hệ Medieval không thể được trang bị vũ khí của thế hệ ScienceFiction.

Yêu cầu thiết kế:

Sử dụng Abstract Factory Pattern để mở rộng kiến trúc, hỗ trợ tạo binh lính theo từng thế hệ.
Cài đặt với Java/Python.
Tổng Kết
Sau khi hoàn thành toàn bộ bài tập, sinh viên vẽ một class diagram thể hiện toàn bộ hệ thống với tất cả các mẫu thiết kế đã áp dụng và mối quan hệ giữa chúng.
