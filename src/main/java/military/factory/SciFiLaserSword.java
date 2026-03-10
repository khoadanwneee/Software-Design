package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class SciFiLaserSword extends EquipmentDecorator {
    private static final int ATTACK_BONUS = 35;
    private int durability = 6;

    public SciFiLaserSword(Soldier soldier) {
        super(soldier);
    }

    @Override
    public int hit() {
        int base = super.hit();
        if (durability > 0) {
            durability--;
            int total = base + ATTACK_BONUS;
            System.out.println("[Laser Sword] " + getName() + " gains +" + ATTACK_BONUS
                    + " attack (" + base + " -> " + total + ") | durability: " + durability);
            return total;
        }
        System.out.println("[Laser Sword] " + getName() + "'s laser sword is depleted!");
        return base;
    }
}
