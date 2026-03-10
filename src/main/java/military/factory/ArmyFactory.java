package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public interface ArmyFactory {
    Soldier createInfantryman();

    Soldier createHorseman();

    EquipmentDecorator createWeapon(Soldier soldier);

    EquipmentDecorator createArmor(Soldier soldier);
}
