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
