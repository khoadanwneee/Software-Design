package military.factory;

import military.core.Horseman;
import military.core.Infantryman;
import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class MedievalFactory implements ArmyFactory {
    @Override
    public Soldier createInfantryman() {
        return new Infantryman();
    }

    @Override
    public Soldier createHorseman() {
        return new Horseman();
    }

    @Override
    public EquipmentDecorator createWeapon(Soldier soldier) {
        return new MedievalSword(soldier);
    }

    @Override
    public EquipmentDecorator createArmor(Soldier soldier) {
        return new MedievalArmor(soldier);
    }
}
