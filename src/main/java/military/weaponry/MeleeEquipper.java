package military.weaponry;

import military.core.Soldier;
import military.weapons.MeleeWeapon;

public class MeleeEquipper extends SoldierEquipper {
    private MeleeWeapon weapon;

    public MeleeEquipper(Soldier soldier, MeleeWeapon weapon) {
        super(soldier);
        this.weapon = weapon;
    }

    @Override
    public int hit() {
        int baseDamage = super.hit(); 
        System.out.println(getName() + " attacks with " + weapon.getName() + ", adding " + weapon.getBonusDamage() + " damage!");
        return baseDamage + weapon.getBonusDamage();
    }
    
}
