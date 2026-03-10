package military.visitor;

import military.core.Horseman;
import military.core.Infantryman;
import military.organization.SoldierGroup;

public interface SoldierVisitor {
    void visitInfantryman(Infantryman infantryman);

    void visitHorseman(Horseman horseman);

    void visitGroup(SoldierGroup group);
}
