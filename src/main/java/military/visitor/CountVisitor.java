package military.visitor;

import military.core.Horseman;
import military.core.Infantryman;
import military.core.Soldier;
import military.organization.SoldierGroup;

public class CountVisitor implements SoldierVisitor {
    private int infantryCount = 0;
    private int horsemanCount = 0;

    @Override
    public void visitInfantryman(Infantryman infantryman) {
        infantryCount++;
    }

    @Override
    public void visitHorseman(Horseman horseman) {
        horsemanCount++;
    }

    @Override
    public void visitGroup(SoldierGroup group) {
        for (Soldier member : group.getMembers()) {
            member.accept(this);
        }
    }

    public int getInfantryCount() {
        return infantryCount;
    }

    public int getHorsemanCount() {
        return horsemanCount;
    }

    public void report() {
        System.out.println("Infantry: " + infantryCount + ", Horsemen: " + horsemanCount
                + ", Total: " + (infantryCount + horsemanCount));
    }
}
