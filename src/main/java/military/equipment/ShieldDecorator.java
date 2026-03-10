package military.equipment;

import military.core.Soldier;

public class ShieldDecorator extends EquipmentDecorator {
    private static final int DEFENSE_BONUS = 5;
    private int durability = 3;

    public ShieldDecorator(Soldier soldier) {
        super(soldier);
    }

    @Override
    public boolean wardOff(int strength) {
        if (durability > 0) {
            durability--;
            int reduced = Math.max(strength - DEFENSE_BONUS, 0);
            System.out.println("[Shield] " + getName() + " blocks " + DEFENSE_BONUS
                    + " damage (" + strength + " -> " + reduced + ") | durability: " + durability);
            return super.wardOff(reduced);
        }
        System.out.println("[Shield] " + getName() + "'s shield is broken!");
        return super.wardOff(strength);
    }
}
