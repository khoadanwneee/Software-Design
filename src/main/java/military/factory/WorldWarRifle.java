package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class WorldWarRifle extends EquipmentDecorator {
    private static final int ATTACK_BONUS = 20;
    private int durability = 5;

    public WorldWarRifle(Soldier soldier) {
        super(soldier);
    }

    @Override
    public int hit() {
        int base = super.hit();
        if (durability > 0) {
            durability--;
            int total = base + ATTACK_BONUS;
            System.out.println("[Rifle] " + getName() + " gains +" + ATTACK_BONUS
                    + " attack (" + base + " -> " + total + ") | durability: " + durability);
            return total;
        }
        System.out.println("[Rifle] " + getName() + "'s rifle jammed!");
        return base;
    }
}
