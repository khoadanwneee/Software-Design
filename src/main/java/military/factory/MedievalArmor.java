package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class MedievalArmor extends EquipmentDecorator {
    private static final int DEFENSE_BONUS = 6;
    private int durability = 4;

    public MedievalArmor(Soldier soldier) {
        super(soldier);
    }

    @Override
    public boolean wardOff(int strength) {
        if (durability > 0) {
            durability--;
            int reduced = Math.max(strength - DEFENSE_BONUS, 0);
            System.out.println("[Medieval Armor] " + getName() + " blocks " + DEFENSE_BONUS
                    + " damage (" + strength + " -> " + reduced + ") | durability: " + durability);
            return super.wardOff(reduced);
        }
        System.out.println("[Medieval Armor] " + getName() + "'s armor is broken!");
        return super.wardOff(strength);
    }
}
