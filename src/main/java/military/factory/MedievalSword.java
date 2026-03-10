package military.factory;

import military.core.Soldier;
import military.equipment.EquipmentDecorator;

public class MedievalSword extends EquipmentDecorator {
    private static final int ATTACK_BONUS = 8;
    private int durability = 4;

    public MedievalSword(Soldier soldier) {
        super(soldier);
    }

    @Override
    public int hit() {
        int base = super.hit();
        if (durability > 0) {
            durability--;
            int total = base + ATTACK_BONUS;
            System.out.println("[Medieval Sword] " + getName() + " gains +" + ATTACK_BONUS
                    + " attack (" + base + " -> " + total + ") | durability: " + durability);
            return total;
        }
        System.out.println("[Medieval Sword] " + getName() + "'s sword is broken!");
        return base;
    }
}
