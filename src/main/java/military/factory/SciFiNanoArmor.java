package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class SciFiNanoArmor extends EquipmentDecorator {
    private static final int DEFENSE_BONUS = 20;
    private int durability = 6;

    public SciFiNanoArmor(Soldier soldier) {
        super(soldier);
    }

    @Override
    public boolean wardOff(int strength) {
        if (durability > 0) {
            durability--;
            int reduced = Math.max(strength - DEFENSE_BONUS, 0);
            System.out.println("[Nano Armor] " + getName() + " blocks " + DEFENSE_BONUS
                    + " damage (" + strength + " -> " + reduced + ") | durability: " + durability);
            return super.wardOff(reduced);
        }
        System.out.println("[Nano Armor] " + getName() + "'s nano armor is depleted!");
        return super.wardOff(strength);
    }
}
