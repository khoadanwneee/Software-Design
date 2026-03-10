# System Design — Class Diagrams by Phase

> Mỗi phase thể hiện incremental design. Diagram phản ánh đúng code đã implement.

---

## Phase 1 — Soldier Base

**Scope:** Định nghĩa `Soldier` interface và 2 concrete class `Infantryman`, `Horseman` với các hành động cơ bản `hit()` và `wardOff()`.

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Infantryman {
        -String name
        -int hp = 100
        -int attackPower = 10
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Horseman {
        -String name
        -int hp = 250
        -int attackPower = 15
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
```

---

## Phase 2 — Decorator Equipment

**Scope:** Thêm `EquipmentDecorator` (abstract) wrap `Soldier`. `ShieldDecorator` tăng phòng thủ, `SwordDecorator` tăng tấn công. In chuỗi gọi phương thức.

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Infantryman {
        -int hp = 100
        -int attackPower = 10
    }

    class Horseman {
        -int hp = 250
        -int attackPower = 15
    }

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class ShieldDecorator {
        -int DEFENSE_BONUS = 5
        +wardOff(int strength) boolean
    }

    class SwordDecorator {
        -int ATTACK_BONUS = 7
        +hit() int
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
```

---

## Phase 3 — Proxy Constraint

**Scope:** Thêm `SoldierProxy` implement `Soldier`, cung cấp `addShield()`/`addSword()` với ràng buộc không trùng lặp trang bị bằng `Set<String>`.

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Infantryman
    class Horseman

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
    }
    class ShieldDecorator
    class SwordDecorator

    class SoldierProxy {
        -Soldier soldier
        -Set~String~ equippedTypes
        +addShield() boolean
        +addSword() boolean
        -addEquipment(String type) boolean
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    Soldier <|.. SoldierProxy
    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
    SoldierProxy o-- Soldier : soldier
    SoldierProxy ..> ShieldDecorator : creates
    SoldierProxy ..> SwordDecorator : creates
```

---

## Phase 4 — Equipment Durability

**Scope:** Thêm `durability` vào `ShieldDecorator` và `SwordDecorator`. Trang bị giảm hiệu quả sau mỗi lần sử dụng, transparent với client code.

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Infantryman
    class Horseman

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
    }

    class ShieldDecorator {
        -int DEFENSE_BONUS = 5
        -int durability = 3
        +wardOff(int strength) boolean
    }

    class SwordDecorator {
        -int ATTACK_BONUS = 7
        -int durability = 3
        +hit() int
    }

    class SoldierProxy {
        -Soldier soldier
        -Set~String~ equippedTypes
        +addShield() boolean
        +addSword() boolean
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    Soldier <|.. SoldierProxy
    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
    SoldierProxy o-- Soldier : soldier

    note for ShieldDecorator "durability giảm mỗi wardOff()\nKhi hết → không block"
    note for SwordDecorator "durability giảm mỗi hit()\nKhi hết → không bonus"
```

---

## Phase 5 — Composite Army

**Scope:** Thêm `SoldierGroup` implement `Soldier` — chứa `List<Soldier>`. `hit()` = tổng attack, `wardOff()` = chia đều damage. Hỗ trợ nested groups.

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    class Infantryman
    class Horseman

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
    }
    class ShieldDecorator
    class SwordDecorator

    class SoldierProxy {
        -Soldier soldier
        -Set~String~ equippedTypes
    }

    class SoldierGroup {
        -String name
        -List~Soldier~ members
        +addSoldier(Soldier soldier) void
        +removeSoldier(Soldier soldier) void
        +getMembers() List~Soldier~
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    Soldier <|.. SoldierProxy
    Soldier <|.. SoldierGroup
    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
    SoldierProxy o-- Soldier : soldier
    SoldierGroup o-- "0..*" Soldier : members
```

---

## Phase 6 — Visitor Operations

**Scope:** Thêm `accept(SoldierVisitor)` vào `Soldier` interface. Tạo `SoldierVisitor` interface + `DisplayVisitor` (in danh sách) và `CountVisitor` (đếm loại).

```mermaid
classDiagram
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
        +accept(SoldierVisitor visitor) void
    }

    class Infantryman {
        +accept(SoldierVisitor visitor) void
    }
    class Horseman {
        +accept(SoldierVisitor visitor) void
    }

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
        +accept(SoldierVisitor visitor) void
    }
    class ShieldDecorator
    class SwordDecorator

    class SoldierProxy {
        +accept(SoldierVisitor visitor) void
    }

    class SoldierGroup {
        -List~Soldier~ members
        +accept(SoldierVisitor visitor) void
    }

    class SoldierVisitor {
        <<interface>>
        +visitInfantryman(Infantryman infantryman) void
        +visitHorseman(Horseman horseman) void
        +visitGroup(SoldierGroup group) void
    }

    class DisplayVisitor {
        -int indent
        +visitInfantryman(Infantryman infantryman) void
        +visitHorseman(Horseman horseman) void
        +visitGroup(SoldierGroup group) void
    }

    class CountVisitor {
        -int infantryCount
        -int horsemanCount
        +visitInfantryman(Infantryman infantryman) void
        +visitHorseman(Horseman horseman) void
        +visitGroup(SoldierGroup group) void
        +getInfantryCount() int
        +getHorsemanCount() int
        +report() void
    }

    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    Soldier <|.. SoldierProxy
    Soldier <|.. SoldierGroup
    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
    SoldierProxy o-- Soldier : soldier
    SoldierGroup o-- "0..*" Soldier : members

    SoldierVisitor <|.. DisplayVisitor
    SoldierVisitor <|.. CountVisitor
    Soldier ..> SoldierVisitor : accept
    SoldierVisitor ..> Infantryman : visits
    SoldierVisitor ..> Horseman : visits
    SoldierVisitor ..> SoldierGroup : visits
```

---

## Phase 7 — Observer Monitoring

**Scope:** Thêm `BattleObserver` interface + `BattleSubject` quản lý observers. `DeathCountObserver` đếm tử trận, `DeathNotifierObserver` thông báo + gửi email mô phỏng.

```mermaid
classDiagram
    class BattleObserver {
        <<interface>>
        +onSoldierDeath(Soldier soldier) void
    }

    class BattleSubject {
        -List~BattleObserver~ observers
        +attach(BattleObserver observer) void
        +detach(BattleObserver observer) void
        +notifyDeath(Soldier soldier) void
    }

    class DeathCountObserver {
        -int deathCount
        +onSoldierDeath(Soldier soldier) void
        +getDeathCount() int
    }

    class DeathNotifierObserver {
        +onSoldierDeath(Soldier soldier) void
    }

    class Soldier {
        <<interface>>
    }

    BattleObserver <|.. DeathCountObserver
    BattleObserver <|.. DeathNotifierObserver
    BattleSubject o-- "0..*" BattleObserver : observers
    BattleSubject ..> Soldier : notifyDeath
```

---

## Phase 8 — Singleton Observers

**Scope:** Chuyển `DeathCountObserver` và `DeathNotifierObserver` thành Singleton: private constructor + static `getInstance()`.

```mermaid
classDiagram
    class BattleObserver {
        <<interface>>
        +onSoldierDeath(Soldier soldier) void
    }

    class BattleSubject {
        -List~BattleObserver~ observers
        +attach(BattleObserver observer) void
        +detach(BattleObserver observer) void
        +notifyDeath(Soldier soldier) void
    }

    class DeathCountObserver {
        -DeathCountObserver instance$
        -int deathCount
        -DeathCountObserver()
        +getInstance()$ DeathCountObserver
        +onSoldierDeath(Soldier soldier) void
        +getDeathCount() int
    }

    class DeathNotifierObserver {
        -DeathNotifierObserver instance$
        -DeathNotifierObserver()
        +getInstance()$ DeathNotifierObserver
        +onSoldierDeath(Soldier soldier) void
    }

    BattleObserver <|.. DeathCountObserver
    BattleObserver <|.. DeathNotifierObserver
    BattleSubject o-- "0..*" BattleObserver : observers

    note for DeathCountObserver "Singleton: private constructor\nLazy initialization"
    note for DeathNotifierObserver "Singleton: private constructor\nLazy initialization"
```

---

## Phase 9 — Abstract Factory Generations

**Scope:** `ArmyFactory` interface + 3 concrete factories (Medieval, WorldWar, SciFi). Mỗi factory tạo binh lính + trang bị tương thích thế hệ. Equipment là `EquipmentDecorator` subclass.

```mermaid
classDiagram
    class ArmyFactory {
        <<interface>>
        +createInfantryman() Soldier
        +createHorseman() Soldier
        +createWeapon(Soldier soldier) EquipmentDecorator
        +createArmor(Soldier soldier) EquipmentDecorator
    }

    class MedievalFactory {
        +createInfantryman() Soldier
        +createHorseman() Soldier
        +createWeapon(Soldier soldier) EquipmentDecorator
        +createArmor(Soldier soldier) EquipmentDecorator
    }

    class WorldWarFactory {
        +createInfantryman() Soldier
        +createHorseman() Soldier
        +createWeapon(Soldier soldier) EquipmentDecorator
        +createArmor(Soldier soldier) EquipmentDecorator
    }

    class SciFiFactory {
        +createInfantryman() Soldier
        +createHorseman() Soldier
        +createWeapon(Soldier soldier) EquipmentDecorator
        +createArmor(Soldier soldier) EquipmentDecorator
    }

    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
    }

    class MedievalSword {
        -int ATTACK_BONUS = 8
        -int durability = 4
        +hit() int
    }

    class MedievalArmor {
        -int DEFENSE_BONUS = 6
        -int durability = 4
        +wardOff(int strength) boolean
    }

    class WorldWarRifle {
        -int ATTACK_BONUS = 20
        -int durability = 5
        +hit() int
    }

    class WorldWarHelmet {
        -int DEFENSE_BONUS = 10
        -int durability = 5
        +wardOff(int strength) boolean
    }

    class SciFiLaserSword {
        -int ATTACK_BONUS = 35
        -int durability = 6
        +hit() int
    }

    class SciFiNanoArmor {
        -int DEFENSE_BONUS = 20
        -int durability = 6
        +wardOff(int strength) boolean
    }

    ArmyFactory <|.. MedievalFactory
    ArmyFactory <|.. WorldWarFactory
    ArmyFactory <|.. SciFiFactory

    EquipmentDecorator <|-- MedievalSword
    EquipmentDecorator <|-- MedievalArmor
    EquipmentDecorator <|-- WorldWarRifle
    EquipmentDecorator <|-- WorldWarHelmet
    EquipmentDecorator <|-- SciFiLaserSword
    EquipmentDecorator <|-- SciFiNanoArmor

    MedievalFactory ..> MedievalSword : creates
    MedievalFactory ..> MedievalArmor : creates
    WorldWarFactory ..> WorldWarRifle : creates
    WorldWarFactory ..> WorldWarHelmet : creates
    SciFiFactory ..> SciFiLaserSword : creates
    SciFiFactory ..> SciFiNanoArmor : creates
```

---

## Final System Overview

**Scope:** Toàn bộ hệ thống với 7 design patterns: Decorator, Proxy, Composite, Visitor, Observer, Singleton, Abstract Factory.

```mermaid
classDiagram
    %% === CORE ===
    class Soldier {
        <<interface>>
        +hit() int
        +wardOff(int strength) boolean
        +getName() String
        +isAlive() boolean
        +accept(SoldierVisitor visitor) void
    }

    class Infantryman {
        -String name
        -int hp = 100
        -int attackPower = 10
        +hit() int
        +wardOff(int strength) boolean
        +accept(SoldierVisitor visitor) void
    }

    class Horseman {
        -String name
        -int hp = 250
        -int attackPower = 15
        +hit() int
        +wardOff(int strength) boolean
        +accept(SoldierVisitor visitor) void
    }

    %% === DECORATOR ===
    class EquipmentDecorator {
        <<abstract>>
        #Soldier wrappedSoldier
        +hit() int
        +wardOff(int strength) boolean
        +accept(SoldierVisitor visitor) void
    }

    class ShieldDecorator {
        -int DEFENSE_BONUS = 5
        -int durability = 3
        +wardOff(int strength) boolean
    }

    class SwordDecorator {
        -int ATTACK_BONUS = 7
        -int durability = 3
        +hit() int
    }

    %% === PROXY ===
    class SoldierProxy {
        -Soldier soldier
        -Set~String~ equippedTypes
        +addShield() boolean
        +addSword() boolean
        -addEquipment(String type) boolean
        +hit() int
        +wardOff(int strength) boolean
        +accept(SoldierVisitor visitor) void
    }

    %% === COMPOSITE ===
    class SoldierGroup {
        -String name
        -List~Soldier~ members
        +addSoldier(Soldier soldier) void
        +removeSoldier(Soldier soldier) void
        +getMembers() List~Soldier~
        +hit() int
        +wardOff(int strength) boolean
        +accept(SoldierVisitor visitor) void
    }

    %% === VISITOR ===
    class SoldierVisitor {
        <<interface>>
        +visitInfantryman(Infantryman) void
        +visitHorseman(Horseman) void
        +visitGroup(SoldierGroup) void
    }

    class DisplayVisitor {
        -int indent
        +visitInfantryman(Infantryman) void
        +visitHorseman(Horseman) void
        +visitGroup(SoldierGroup) void
    }

    class CountVisitor {
        -int infantryCount
        -int horsemanCount
        +visitInfantryman(Infantryman) void
        +visitHorseman(Horseman) void
        +visitGroup(SoldierGroup) void
        +getInfantryCount() int
        +getHorsemanCount() int
        +report() void
    }

    %% === OBSERVER ===
    class BattleObserver {
        <<interface>>
        +onSoldierDeath(Soldier soldier) void
    }

    class BattleSubject {
        -List~BattleObserver~ observers
        +attach(BattleObserver) void
        +detach(BattleObserver) void
        +notifyDeath(Soldier) void
    }

    class DeathCountObserver {
        -DeathCountObserver instance$
        -int deathCount
        -DeathCountObserver()
        +getInstance()$ DeathCountObserver
        +onSoldierDeath(Soldier) void
        +getDeathCount() int
    }

    class DeathNotifierObserver {
        -DeathNotifierObserver instance$
        -DeathNotifierObserver()
        +getInstance()$ DeathNotifierObserver
        +onSoldierDeath(Soldier) void
    }

    %% === ABSTRACT FACTORY ===
    class ArmyFactory {
        <<interface>>
        +createInfantryman() Soldier
        +createHorseman() Soldier
        +createWeapon(Soldier) EquipmentDecorator
        +createArmor(Soldier) EquipmentDecorator
    }

    class MedievalFactory
    class WorldWarFactory
    class SciFiFactory

    class MedievalSword {
        -int ATTACK_BONUS = 8
        -int durability = 4
    }
    class MedievalArmor {
        -int DEFENSE_BONUS = 6
        -int durability = 4
    }
    class WorldWarRifle {
        -int ATTACK_BONUS = 20
        -int durability = 5
    }
    class WorldWarHelmet {
        -int DEFENSE_BONUS = 10
        -int durability = 5
    }
    class SciFiLaserSword {
        -int ATTACK_BONUS = 35
        -int durability = 6
    }
    class SciFiNanoArmor {
        -int DEFENSE_BONUS = 20
        -int durability = 6
    }

    %% === RELATIONSHIPS ===
    Soldier <|.. Infantryman
    Soldier <|.. Horseman
    Soldier <|.. EquipmentDecorator
    Soldier <|.. SoldierProxy
    Soldier <|.. SoldierGroup

    EquipmentDecorator o-- Soldier : wrappedSoldier
    EquipmentDecorator <|-- ShieldDecorator
    EquipmentDecorator <|-- SwordDecorator
    EquipmentDecorator <|-- MedievalSword
    EquipmentDecorator <|-- MedievalArmor
    EquipmentDecorator <|-- WorldWarRifle
    EquipmentDecorator <|-- WorldWarHelmet
    EquipmentDecorator <|-- SciFiLaserSword
    EquipmentDecorator <|-- SciFiNanoArmor

    SoldierProxy o-- Soldier : soldier
    SoldierGroup o-- "0..*" Soldier : members

    SoldierVisitor <|.. DisplayVisitor
    SoldierVisitor <|.. CountVisitor
    Soldier ..> SoldierVisitor : accept

    BattleObserver <|.. DeathCountObserver
    BattleObserver <|.. DeathNotifierObserver
    BattleSubject o-- "0..*" BattleObserver : observers

    ArmyFactory <|.. MedievalFactory
    ArmyFactory <|.. WorldWarFactory
    ArmyFactory <|.. SciFiFactory
    MedievalFactory ..> MedievalSword : creates
    MedievalFactory ..> MedievalArmor : creates
    WorldWarFactory ..> WorldWarRifle : creates
    WorldWarFactory ..> WorldWarHelmet : creates
    SciFiFactory ..> SciFiLaserSword : creates
    SciFiFactory ..> SciFiNanoArmor : creates
    ArmyFactory ..> Infantryman : creates
    ArmyFactory ..> Horseman : creates
```
