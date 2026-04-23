# Class Diagrams

## Soldier Base

Định nghĩa `Soldier` interface và 2 concrete class `Infantryman`, `Horseman` với các hành động cơ bản `hit()` và `wardOff()`.

![Diagram](./Soldier%20Visitor%20Interaction-2026-03-21-154504.png)

## Decorator Equipment

Thêm `EquipmentDecorator` (abstract) wrap `Soldier`. `ShieldDecorator` tăng phòng thủ, `SwordDecorator` tăng tấn công.

![Diagram](./Soldier%20Visitor%20Interaction-2026-03-21-154816.png)

**Trả lời câu hỏi:**

**Câu 5:**
> Theo Decorator Pattern, “chức năng của đối tượng trở nên phong phú hơn” – điều này có đúng trong trường hợp này không?

**ĐÚNG** 

**Giải thích:**

Trong thiết kế sử dụng **Decorator Pattern**, mỗi trang bị (như Shield, Sword) được cài đặt dưới dạng một decorator và bao bọc (wrap) đối tượng Soldier.

Mỗi decorator:

* Bổ sung hoặc thay đổi hành vi của các phương thức như `hit()` và `wardOff()`
* Ví dụ:

  * Sword làm tăng sức tấn công (`hit()`)
  * Shield cải thiện khả năng phòng thủ (`wardOff()`)

Khi nhiều decorator được kết hợp, hành vi của đối tượng trở nên linh hoạt hơn do có thể tích hợp nhiều hiệu ứng khác nhau tại runtime.

Do đó, chức năng của đối tượng thực sự trở nên **“phong phú hơn”** thông qua việc mở rộng hành vi mà không cần thay đổi lớp gốc. 


**Câu 6:**
> Nếu có thêm ràng buộc: một binh lính không thể mang hai trang bị cùng loại – Decorator có phải là phương pháp thích hợp để đảm bảo ràng buộc này không?

**KHÔNG phù hợp**

**Giải thích:**

Decorator Pattern chỉ tập trung vào việc:

* Mở rộng hành vi của đối tượng
* Kết hợp linh hoạt nhiều lớp decorator

Tuy nhiên, nó:

* Không quản lý trạng thái tổng thể của object
* Không kiểm soát việc gắn trùng decorator

Do đó, nếu chỉ sử dụng decorator, hệ thống vẫn có thể cho phép gắn nhiều trang bị cùng loại (ví dụ: hai SwordDecorator).

Để đảm bảo ràng buộc này, cần sử dụng một cơ chế kiểm soát bên ngoài, chẳng hạn như **Proxy Pattern**, nhằm:

* Theo dõi các trang bị đã được gắn
* Ngăn chặn việc gắn trùng

$\Rightarrow$ Vì vậy, Decorator **không phải là lựa chọn phù hợp** để đảm bảo ràng buộc này.

## Proxy Constraint

Thêm `SoldierProxy` implement `Soldier`, cung cấp `addShield()`/`addSword()` với ràng buộc không trùng lặp trang bị.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-155233.png)

## Equipment Durability

Thêm `durability` vào `ShieldDecorator` và `SwordDecorator`. Trang bị giảm hiệu quả sau mỗi lần sử dụng.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-155508.png)

## Composite Army

Thêm `SoldierGroup` implement `Soldier` - chứa `List<Soldier>`. `hit()` = tổng attack, `wardOff()` = chia đều damage. Do SoldierGroup cũng triển khai interface Soldier, nên một nhóm có thể chứa các nhóm con, tạo thành cấu trúc phân cấp.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-160147.png)

## Visitor Operations

Thêm `accept(SoldierVisitor)` vào `Soldier` interface. Tạo `SoldierVisitor` interface + `DisplayVisitor` (in danh sách) và `CountVisitor` (đếm loại).

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-162252.png)

## Observer Monitoring

Thêm `BattleObserver` interface + `BattleSubject` quản lý observers. `DeathCountObserver` đếm tử trận, `DeathNotifierObserver` thông báo + gửi email mô phỏng.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-160658.png)

## Singleton Observers

Chuyển `DeathCountObserver` và `DeathNotifierObserver` thành Singleton: private constructor + static `getInstance()`.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-162943.png)

## Abstract Factory Generations

`ArmyFactory` interface + 3 concrete factories (Medieval, WorldWar, SciFi). Mỗi factory tạo binh lính + trang bị tương thích thế hệ. Equipment là `EquipmentDecorator` subclass.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-163730.png)

## Final System Overview

Toàn bộ hệ thống với 7 design patterns: Decorator, Proxy, Composite, Visitor, Observer, Singleton, Abstract Factory.

![Diagram](./Animal%20Kingdom%20Class%20Model-2026-03-21-164350.png)

[Link to Diagram](https://mermaid.ai/d/b620c1b6-b8ed-4c81-b848-dd8b49e03cc9)
