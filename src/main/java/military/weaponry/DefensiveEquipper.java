package military.weaponry;

import military.core.Soldier;
import military.weapons.DefensiveWeapon;

public class DefensiveEquipper extends SoldierEquipper {
    private DefensiveWeapon weapon;

    public DefensiveEquipper(Soldier soldier, DefensiveWeapon weapon) {
        super(soldier);
        this.weapon = weapon;
    }

    @Override
    public boolean wardOff(int strength) {
        int reducedStrength = Math.max(0, strength - weapon.getWardBonus());
        System.out.println(getName() + "'s " + weapon.getName() + " blocks " + 
                        weapon.getWardBonus() + " damage!");
        return super.wardOff(reducedStrength);
    }
    
}
