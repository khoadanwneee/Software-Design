# Decisions Log

## 2026-03-10 — DEC-001: Soldier interface thêm getName() và isAlive()

**Context:** Requirement chỉ yêu cầu `hit()` và `wardOff()`. Tuy nhiên các phase sau (Observer, Visitor, Composite) cần biết tên và trạng thái sống/chết của binh lính.

**Decision:** Thêm `getName()` và `isAlive()` vào `Soldier` interface ngay từ đầu.

**Reason:** Tránh breaking change ở các phase sau. Hai method này là thuộc tính cơ bản của mọi binh lính.

---

## 2026-03-10 — DEC-002: Chỉ số cơ bản Infantryman vs Horseman

**Context:** Requirement không chỉ rõ HP và attack cụ thể.

**Decision:** Infantryman: HP=100, attack=10. Horseman: HP=150, attack=15.

**Assumption:** Kỵ binh mạnh hơn bộ binh cả tấn công lẫn phòng thủ (hợp lý với bối cảnh quân sự). Có thể điều chỉnh sau.

---

## 2026-03-10 — DEC-003: Auto-naming bằng static counter

**Context:** Cần phân biệt từng binh lính khi in log.

**Decision:** Dùng static counter trong mỗi class (`Infantryman#1`, `Horseman#2`...).

**Tradeoff:** Đơn giản, đủ dùng cho mô phỏng. Không thread-safe nhưng requirement không yêu cầu concurrency.

---

## 2026-03-10 — DEC-004: accept() thêm vào Soldier interface (breaking change)

**Context:** Visitor Pattern yêu cầu mọi Soldier phải có accept(SoldierVisitor). Đây là thay đổi interface, ảnh hưởng tất cả implementations.

**Decision:** Thêm accept() vào Soldier interface và cập nhật tất cả 6 class implement Soldier (Infantryman, Horseman, SoldierGroup, EquipmentDecorator, SoldierProxy + 2 concrete decorators kế thừa từ EquipmentDecorator).

**Reason:** Cần double dispatch cho Visitor. EquipmentDecorator và SoldierProxy delegate accept() xuống wrapped soldier để visitor đến đúng concrete type.

---

## 2026-03-10 — DEC-005: Abstract Factory trả về EquipmentDecorator thay vì Weapon/Armor interface riêng

**Context:** Có thể tạo Weapon/Armor interface riêng, nhưng trang bị trong hệ thống đã là EquipmentDecorator (Decorator pattern từ Phase 2).

**Decision:** ArmyFactory.createWeapon()/createArmor() trả về EquipmentDecorator. Mỗi thế hệ có concrete decorator riêng (MedievalSword, WorldWarRifle, SciFiLaserSword...).

**Reason:** Tái sử dụng EquipmentDecorator, không cần thêm layer abstraction. Factory đảm bảo trang bị luôn tương thích với thế hệ vì chỉ tạo đúng loại.
