# Changelog

## 2026-03-10 — Phase 1: Soldier Base Model

**Task:** Implement Soldier interface, Infantryman, Horseman

**Files created:**

- `src/main/java/military/core/Soldier.java` — Interface: `hit()`, `wardOff(int)`, `getName()`, `isAlive()`
- `src/main/java/military/core/Infantryman.java` — HP=100, attack=10
- `src/main/java/military/core/Horseman.java` — HP=150, attack=15

**Reason:** Phase 1 of roadmap — foundation layer cho toàn bộ hệ thống

**Outcome:** 3 files tạo mới, compile-ready, chưa cần dependency ngoài

---

## 2026-03-10 — Phase 2: Decorator Equipment

**Task:** Implement Decorator Pattern cho trang bị binh lính

**Files created:**

- `src/main/java/military/equipment/EquipmentDecorator.java` — Abstract decorator, wrap Soldier, delegate all methods
- `src/main/java/military/equipment/ShieldDecorator.java` — wardOff(): giảm damage 5 điểm, in call chain
- `src/main/java/military/equipment/SwordDecorator.java` — hit(): tăng attack 7 điểm, in call chain

**Reason:** Phase 2 of roadmap — cho phép gắn trang bị lên binh lính bằng Decorator

**Outcome:** 3 files tạo mới. Decorator stack-able (có thể gắn Shield + Sword). In chuỗi gọi method.

---

## 2026-03-10 — Phase 3: Proxy Constraint

**Task:** Implement Proxy Pattern kiểm soát ràng buộc trang bị

**Files created:**

- `src/main/java/military/proxy/SoldierProxy.java` — Proxy wrap Soldier, addShield()/addSword() với duplicate check, extensible via switch

**Reason:** Phase 3 of roadmap — enforce "không trùng lặp trang bị"

**Outcome:** 1 file tạo mới. Proxy tracks equipped types bằng Set<String>, reject duplicate.

---

## 2026-03-10 — Phase 4: Equipment Durability

**Task:** Thêm cơ chế hao mòn trang bị

**Files modified:**

- `src/main/java/military/equipment/ShieldDecorator.java` — durability=3, giảm sau mỗi wardOff(), khi hết thì không block
- `src/main/java/military/equipment/SwordDecorator.java` — durability=3, giảm sau mỗi hit(), khi hết thì không bonus

**Reason:** Phase 4 of roadmap — hao mòn transparent với client code

**Outcome:** 2 files sửa. Durability=3 cho cả hai. Client code không cần thay đổi.

---

## 2026-03-10 — Phase 5: Composite Army

**Task:** Implement Composite Pattern cho nhóm/quân đội

**Files created:**

- `src/main/java/military/organization/SoldierGroup.java` — Composite: hit()=tổng, wardOff()=chia đều, nested groups

**Reason:** Phase 5 of roadmap — tổ chức phân cấp quân đội

**Outcome:** 1 file tạo mới. SoldierGroup implements Soldier, hỗ trợ add/remove, damage chia đều với remainder handling.

---

## 2026-03-10 — Phase 6: Visitor Operations

**Task:** Implement Visitor Pattern cho cấu trúc quân đội

**Files created:**

- `src/main/java/military/visitor/SoldierVisitor.java` — Interface: visitInfantryman(), visitHorseman(), visitGroup()
- `src/main/java/military/visitor/DisplayVisitor.java` — In danh sách quân đội với indent
- `src/main/java/military/visitor/CountVisitor.java` — Đếm Infantryman và Horseman

**Files modified:**

- `src/main/java/military/core/Soldier.java` — Thêm accept(SoldierVisitor)
- `src/main/java/military/core/Infantryman.java` — Implement accept()
- `src/main/java/military/core/Horseman.java` — Implement accept()
- `src/main/java/military/organization/SoldierGroup.java` — Implement accept()
- `src/main/java/military/equipment/EquipmentDecorator.java` — Delegate accept()
- `src/main/java/military/proxy/SoldierProxy.java` — Delegate accept()

**Reason:** Phase 6 of roadmap — thêm chức năng không sửa class cũ

**Outcome:** 3 files tạo, 6 files sửa. Visitor pattern hoàn chỉnh.

---

## 2026-03-10 — Phase 7: Observer Monitoring

**Task:** Implement Observer Pattern theo dõi trận chiến

**Files created:**

- `src/main/java/military/battle/BattleObserver.java` — Interface: onSoldierDeath(Soldier)
- `src/main/java/military/battle/BattleSubject.java` — attach/detach/notifyDeath
- `src/main/java/military/battle/DeathCountObserver.java` — Đếm tổng số tử trận
- `src/main/java/military/battle/DeathNotifierObserver.java` — Thông báo tên + email mô phỏng

**Reason:** Phase 7 of roadmap — theo dõi biến cố real-time

**Outcome:** 4 files tạo mới. Observer pattern hoàn chỉnh, sẵn sàng cho Singleton.

---

## 2026-03-10 — Phase 8: Singleton Observers

**Task:** Chuyển 2 observers thành Singleton

**Files modified:**

- `src/main/java/military/battle/DeathCountObserver.java` — private constructor + getInstance()
- `src/main/java/military/battle/DeathNotifierObserver.java` — private constructor + getInstance()

**Reason:** Phase 8 of roadmap — đảm bảo duy nhất 1 instance theo dõi trận chiến

**Outcome:** 2 files sửa. Lazy singleton (non-thread-safe, đủ cho bài tập).

---

## 2026-03-10 — Phase 9: Abstract Factory Generations

**Task:** Implement Abstract Factory Pattern cho 3 thế hệ lịch sử

**Files created:**

- `src/main/java/military/factory/ArmyFactory.java` — Abstract factory interface
- `src/main/java/military/factory/MedievalFactory.java` — Medieval: MedievalSword + MedievalArmor
- `src/main/java/military/factory/WorldWarFactory.java` — WorldWar: WorldWarRifle + WorldWarHelmet
- `src/main/java/military/factory/SciFiFactory.java` — SciFi: SciFiLaserSword + SciFiNanoArmor
- `src/main/java/military/factory/MedievalSword.java` — attack +8, durability 4
- `src/main/java/military/factory/MedievalArmor.java` — defense +6, durability 4
- `src/main/java/military/factory/WorldWarRifle.java` — attack +20, durability 5
- `src/main/java/military/factory/WorldWarHelmet.java` — defense +10, durability 5
- `src/main/java/military/factory/SciFiLaserSword.java` — attack +35, durability 6
- `src/main/java/military/factory/SciFiNanoArmor.java` — defense +20, durability 6

**Reason:** Phase 9 of roadmap — biệt lập tạo binh lính/trang bị theo thế hệ

**Outcome:** 10 files tạo mới. Mỗi factory chỉ tạo trang bị cùng thế hệ → đảm bảo ràng buộc tương thích.
