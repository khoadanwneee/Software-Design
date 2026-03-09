# Implementation Roadmap

> Ngôn ngữ: **Java**  
> Base package: `military`  
> Source root: `src/main/java/military/`

---

## Phase 1 – Soldier Base Model

**Mục tiêu:** Định nghĩa interface và các class binh lính cơ bản (Infantryman, Horseman) với hành động `hit()` và `wardOff()`.

**Pattern:** Không (foundation layer)

**Files:**

- `src/main/java/military/core/Soldier.java` — Interface chính: `int hit()`, `boolean wardOff(int strength)`
- `src/main/java/military/core/Infantryman.java` — Bộ binh: HP thấp, tấn công cơ bản
- `src/main/java/military/core/Horseman.java` — Kỵ binh: HP cao, tấn công mạnh hơn

**Status:** `[x]` Done

---

## Phase 2 – Decorator Equipment

**Mục tiêu:** Cho phép gắn trang bị (Shield, Sword) lên binh lính bằng Decorator. In ra chuỗi gọi phương thức khi `hit()`/`wardOff()` được kích hoạt.

**Pattern:** Decorator

**Files:**

- `src/main/java/military/equipment/EquipmentDecorator.java` — Abstract decorator, implement `Soldier`, wrap một `Soldier` bên trong
- `src/main/java/military/equipment/ShieldDecorator.java` — Tăng khả năng phòng thủ (giảm damage nhận vào)
- `src/main/java/military/equipment/SwordDecorator.java` — Tăng sức tấn công

**Status:** `[ ]` Not started

---

## Phase 3 – Proxy Constraint

**Mục tiêu:** Dùng Proxy kiểm soát ràng buộc "không trùng lặp trang bị". Cung cấp interface `addShield()`/`addSword()`. Thiết kế mở rộng để thêm loại trang bị mới mà không sửa code hiện tại.

**Pattern:** Proxy

**Files:**

- `src/main/java/military/proxy/SoldierProxy.java` — Implement `Soldier`, thêm `addShield()`, `addSword()`. Kiểm tra trùng lặp trước khi delegate xuống decorator

**Status:** `[ ]` Not started

---

## Phase 4 – Equipment Durability

**Mục tiêu:** Thêm cơ chế hao mòn trang bị — shield/sword giảm hiệu quả sau mỗi lần sử dụng. Transparent với code bên ngoài (không cần thay đổi client code).

**Pattern:** Decorator (mở rộng)

**Files:**

- Sửa `src/main/java/military/equipment/ShieldDecorator.java` — Thêm `durability` field, giảm sau mỗi `wardOff()`
- Sửa `src/main/java/military/equipment/SwordDecorator.java` — Thêm `durability` field, giảm sau mỗi `hit()`

**Status:** `[ ]` Not started

---

## Phase 5 – Composite Army

**Mục tiêu:** Tổ chức binh lính thành nhóm (group) và quân đội (army) phân cấp. Nhóm hành xử như một binh lính đơn lẻ. Thêm trang bị cho nhóm = thêm cho tất cả thành viên.

**Pattern:** Composite

**Files:**

- `src/main/java/military/organization/SoldierGroup.java` — Composite node: chứa list `Soldier`, `hit()` = tổng, `wardOff()` = chia đều damage

**Status:** `[ ]` Not started

---

## Phase 6 – Visitor Operations

**Mục tiêu:** Thêm chức năng mới cho cấu trúc quân đội mà không sửa class hiện tại. Implement `DisplayVisitor` và `CountVisitor`.

**Pattern:** Visitor

**Files:**

- `src/main/java/military/visitor/SoldierVisitor.java` — Interface: `visitInfantryman()`, `visitHorseman()`, `visitGroup()`
- `src/main/java/military/visitor/DisplayVisitor.java` — In danh sách quân đội (tên, loại, trang bị)
- `src/main/java/military/visitor/CountVisitor.java` — Đếm số lượng Infantryman và Horseman
- Sửa `Soldier.java` — Thêm `void accept(SoldierVisitor visitor)`
- Sửa `Infantryman.java`, `Horseman.java`, `SoldierGroup.java` — Implement `accept()`

**Status:** `[ ]` Not started

---

## Phase 7 – Observer Monitoring

**Mục tiêu:** Theo dõi trận chiến real-time. Khi binh lính tử trận (`wardOff()` trả về `false`), notify tất cả observers.

**Pattern:** Observer

**Files:**

- `src/main/java/military/battle/BattleObserver.java` — Interface: `void onSoldierDeath(Soldier soldier)`
- `src/main/java/military/battle/BattleSubject.java` — Quản lý danh sách observers, `attach()`, `detach()`, `notifyObservers()`
- `src/main/java/military/battle/DeathCountObserver.java` — Đếm tổng số binh lính tử trận
- `src/main/java/military/battle/DeathNotifierObserver.java` — Hiển thị tên tử trận + gửi email mô phỏng

**Status:** `[ ]` Not started

---

## Phase 8 – Singleton Observers

**Mục tiêu:** Đảm bảo `DeathCountObserver` và `DeathNotifierObserver` chỉ có đúng 1 instance trong toàn chương trình.

**Pattern:** Singleton

**Files:**

- Sửa `src/main/java/military/battle/DeathCountObserver.java` — Private constructor + `getInstance()`
- Sửa `src/main/java/military/battle/DeathNotifierObserver.java` — Private constructor + `getInstance()`

**Status:** `[ ]` Not started

---

## Phase 9 – Abstract Factory Generations

**Mục tiêu:** Tạo binh lính + trang bị theo thế hệ lịch sử (Medieval, WorldWar, SciFi). Đảm bảo ràng buộc tương thích: binh lính chỉ dùng trang bị cùng thế hệ.

**Pattern:** Abstract Factory

**Files:**

- `src/main/java/military/factory/ArmyFactory.java` — Abstract factory interface: `createInfantryman()`, `createHorseman()`, `createWeapon()`, `createArmor()`
- `src/main/java/military/factory/MedievalFactory.java` — Kiếm, giáo, áo giáp
- `src/main/java/military/factory/WorldWarFactory.java` — Súng trường, lựu đạn, mũ sắt
- `src/main/java/military/factory/SciFiFactory.java` — Kiếm laser, vũ khí sinh học, giáp nano

**Status:** `[ ]` Not started

---

## Tổng hợp files

| Package                 | Files                                                                    | Patterns            |
| ----------------------- | ------------------------------------------------------------------------ | ------------------- |
| `military.core`         | Soldier, Infantryman, Horseman                                           | —                   |
| `military.equipment`    | EquipmentDecorator, ShieldDecorator, SwordDecorator                      | Decorator           |
| `military.proxy`        | SoldierProxy                                                             | Proxy               |
| `military.organization` | SoldierGroup                                                             | Composite           |
| `military.visitor`      | SoldierVisitor, DisplayVisitor, CountVisitor                             | Visitor             |
| `military.battle`       | BattleObserver, BattleSubject, DeathCountObserver, DeathNotifierObserver | Observer, Singleton |
| `military.factory`      | ArmyFactory, MedievalFactory, WorldWarFactory, SciFiFactory              | Abstract Factory    |
