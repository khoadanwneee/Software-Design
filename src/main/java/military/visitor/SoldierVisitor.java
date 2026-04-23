package military.visitor;

import military.core.Horseman;
import military.core.Infantryman;
import military.organization.SoldierGroup;

public interface SoldierVisitor {
    void visit(Infantryman infantryman);

    void visit(Horseman horseman);

    void visit(SoldierGroup group);
}
