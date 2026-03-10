package military.core;

import military.visitor.SoldierVisitor;

public interface Soldier {
    int hit();

    boolean wardOff(int strength);

    String getName();

    boolean isAlive();

    void accept(SoldierVisitor visitor);
}
