package military.weaponry;

import military.core.Soldier;

public abstract class SoldierEquipper implements Soldier {
    protected Soldier soldier;
    public SoldierEquipper(Soldier soldier) {
        this.soldier = soldier;
    }

    public int hit() {
        return soldier.hit();
    }

    public boolean wardOff(int strength) {
        return soldier.wardOff(strength);
    }

    public String getName() {
        return soldier.getName();
    }

    public boolean isAlive() {
        return soldier.isAlive();
    }
}
