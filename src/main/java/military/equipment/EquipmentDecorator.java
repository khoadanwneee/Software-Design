package military.equipment;

import military.core.Soldier;
import military.visitor.SoldierVisitor;

public abstract class EquipmentDecorator implements Soldier {
    protected final Soldier wrappedSoldier;

    public EquipmentDecorator(Soldier soldier) {
        this.wrappedSoldier = soldier;
    }

    @Override
    public int hit() {
        return wrappedSoldier.hit();
    }

    @Override
    public boolean wardOff(int strength) {
        return wrappedSoldier.wardOff(strength);
    }

    @Override
    public String getName() {
        return wrappedSoldier.getName();
    }

    @Override
    public boolean isAlive() {
        return wrappedSoldier.isAlive();
    }

    @Override
    public void accept(SoldierVisitor visitor) {
        wrappedSoldier.accept(visitor);
    }
}
