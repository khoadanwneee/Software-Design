# Session Log

## Session 1 — 2026-03-10

**Task:** Phase 1 — Soldier Base Model

**Files changed:**

- `src/main/java/military/core/Soldier.java` (created)
- `src/main/java/military/core/Infantryman.java` (created)
- `src/main/java/military/core/Horseman.java` (created)
- `docs/TASKS.md` (updated Phase 1 status → done)
- `docs/CHANGELOG.md` (created)
- `docs/DECISIONS.md` (created)
- `docs/SESSION_LOG.md` (created)

**Reason:** Implement foundation layer theo roadmap Phase 1

**Outcome:** 3 Java files tạo xong. Soldier interface + 2 concrete classes. Minimal code, sẵn sàng cho Phase 2 (Decorator).

**Next step:** Phase 2 — Decorator Equipment (EquipmentDecorator, ShieldDecorator, SwordDecorator)

---

## Session 2 — 2026-03-10

**Task:** Phase 2 — Decorator Equipment

**Files changed:**

- `src/main/java/military/equipment/EquipmentDecorator.java` (created)
- `src/main/java/military/equipment/ShieldDecorator.java` (created)
- `src/main/java/military/equipment/SwordDecorator.java` (created)
- `docs/TASKS.md` (updated Phase 2 status → done)
- `docs/CHANGELOG.md` (appended Phase 2 entry)
- `docs/SESSION_LOG.md` (appended Session 2)

**Reason:** Implement Decorator Pattern theo roadmap Phase 2

**Outcome:** 3 Java files — EquipmentDecorator (abstract), ShieldDecorator (defense +5), SwordDecorator (attack +7). In chuỗi gọi phương thức. Không sửa code Phase 1.

**Next step:** Phase 3 — Proxy Constraint (SoldierProxy)

---

## Session 3 — 2026-03-10

**Task:** Phase 3 — Proxy Constraint

**Files changed:**

- `src/main/java/military/proxy/SoldierProxy.java` (created)
- `docs/TASKS.md` (Phase 3 → done)
- `docs/CHANGELOG.md` (Phase 3 entry)
- `docs/SESSION_LOG.md` (Session 3)

**Reason:** Implement Proxy Pattern theo roadmap Phase 3

**Outcome:** SoldierProxy với addShield()/addSword(), duplicate constraint bằng HashSet. Extensible qua switch pattern.

**Next step:** Phase 4 — Equipment Durability

---

## Session 4 — 2026-03-10

**Task:** Phase 4 — Equipment Durability

**Files changed:**

- `src/main/java/military/equipment/ShieldDecorator.java` (modified)
- `src/main/java/military/equipment/SwordDecorator.java` (modified)
- `docs/TASKS.md` (Phase 4 → done)
- `docs/CHANGELOG.md` (Phase 4 entry)
- `docs/SESSION_LOG.md` (Session 4)

**Reason:** Thêm durability=3 cho Shield và Sword. Transparent với bên ngoài.

**Outcome:** Equipment giảm hiệu quả sau 3 lần dùng, sau đó không có tác dụng.

**Next step:** Phase 5 — Composite Army

---

## Session 5 — 2026-03-10

**Task:** Phase 5 — Composite Army

**Files changed:**

- `src/main/java/military/organization/SoldierGroup.java` (created)
- `docs/TASKS.md` (Phase 5 → done)
- `docs/CHANGELOG.md` (Phase 5 entry)
- `docs/SESSION_LOG.md` (Session 5)

**Reason:** Implement Composite Pattern theo roadmap Phase 5

**Outcome:** SoldierGroup với add/remove, hit()=sum, wardOff()=divide equally. Hỗ trợ nested groups.

**Next step:** Phase 6 — Visitor Operations

---

## Session 6 — 2026-03-10

**Task:** Phase 6 — Visitor Operations

**Files changed:**

- `src/main/java/military/visitor/SoldierVisitor.java` (created)
- `src/main/java/military/visitor/DisplayVisitor.java` (created)
- `src/main/java/military/visitor/CountVisitor.java` (created)
- `src/main/java/military/core/Soldier.java` (modified — added accept())
- `src/main/java/military/core/Infantryman.java` (modified)
- `src/main/java/military/core/Horseman.java` (modified)
- `src/main/java/military/organization/SoldierGroup.java` (modified)
- `src/main/java/military/equipment/EquipmentDecorator.java` (modified)
- `src/main/java/military/proxy/SoldierProxy.java` (modified)

**Reason:** Implement Visitor Pattern theo roadmap Phase 6

**Outcome:** accept() thêm vào Soldier interface + tất cả implementations. DisplayVisitor và CountVisitor hoạt động đệ quy qua cấu trúc composite.

**Next step:** Phase 7 — Observer Monitoring

---

## Session 7 — 2026-03-10

**Task:** Phase 7 — Observer Monitoring

**Files changed:**

- `src/main/java/military/battle/BattleObserver.java` (created)
- `src/main/java/military/battle/BattleSubject.java` (created)
- `src/main/java/military/battle/DeathCountObserver.java` (created)
- `src/main/java/military/battle/DeathNotifierObserver.java` (created)

**Reason:** Implement Observer Pattern theo roadmap Phase 7

**Outcome:** 4 Java files — BattleObserver interface, BattleSubject, 2 concrete observers.

**Next step:** Phase 8 — Singleton Observers

---

## Session 8 — 2026-03-10

**Task:** Phase 8 — Singleton Observers

**Files changed:**

- `src/main/java/military/battle/DeathCountObserver.java` (modified — Singleton)
- `src/main/java/military/battle/DeathNotifierObserver.java` (modified — Singleton)

**Reason:** Implement Singleton Pattern theo roadmap Phase 8

**Outcome:** 2 observers giờ là Singleton. Private constructor, static getInstance().

**Next step:** Phase 9 — Abstract Factory Generations

---

## Session 9 — 2026-03-10

**Task:** Phase 9 — Abstract Factory Generations

**Files changed:**

- `src/main/java/military/factory/ArmyFactory.java` (created)
- `src/main/java/military/factory/MedievalFactory.java` (created)
- `src/main/java/military/factory/WorldWarFactory.java` (created)
- `src/main/java/military/factory/SciFiFactory.java` (created)
- `src/main/java/military/factory/MedievalSword.java` (created)
- `src/main/java/military/factory/MedievalArmor.java` (created)
- `src/main/java/military/factory/WorldWarRifle.java` (created)
- `src/main/java/military/factory/WorldWarHelmet.java` (created)
- `src/main/java/military/factory/SciFiLaserSword.java` (created)
- `src/main/java/military/factory/SciFiNanoArmor.java` (created)

**Reason:** Implement Abstract Factory Pattern theo roadmap Phase 9

**Outcome:** 10 Java files. 3 factories + 6 generation-specific equipment decorators. Ràng buộc tương thích đảm bảo bởi thiết kế factory.

**Next step:** All phases complete. Integration & demo.
