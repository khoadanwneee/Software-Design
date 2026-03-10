package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class WorldWarHelmet extends EquipmentDecorator {
    private static final int DEFENSE_BONUS = 10;
    private int durability = 5;

    public WorldWarHelmet(Soldier soldier) {
        super(soldier);
    }

    @Override
    public boolean wardOff(int strength) {
        if (durability > 0) {
            durability--;
            int reduced = Math.max(strength - DEFENSE_BONUS, 0);
            System.out.println("[Helmet] " + getName() + " blocks " + DEFENSE_BONUS
                    + " damage (" + strength + " -> " + reduced + ") | durability: " + durability);
            return super.wardOff(reduced);
        }
        System.out.println("[Helmet] " + getName() + "'s helmet is dented!");
        return super.wardOff(strength);
    }
}
