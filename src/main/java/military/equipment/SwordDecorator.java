package military.equipment;

import military.core.Soldier;

public class SwordDecorator extends EquipmentDecorator {
    private static final int ATTACK_BONUS = 7;
    private int durability = 3;

    public SwordDecorator(Soldier soldier) {
        super(soldier);
    }

    @Override
    public int hit() {
        int baseDamage = super.hit();
        if (durability > 0) {
            durability--;
            int total = baseDamage + ATTACK_BONUS;
            System.out.println("[Sword] " + getName() + " gains +" + ATTACK_BONUS
                    + " attack (" + baseDamage + " -> " + total + ") | durability: " + durability);
            return total;
        }
        System.out.println("[Sword] " + getName() + "'s sword is broken!");
        return baseDamage;
    }
}
