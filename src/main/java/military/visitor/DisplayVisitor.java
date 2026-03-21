package military.visitor;

import military.core.Horseman;
import military.core.Infantryman;
import military.core.Soldier;
import military.organization.SoldierGroup;

public class DisplayVisitor implements SoldierVisitor {
    private int indent = 0;

    private String prefix() {
        return "  ".repeat(indent);
    }

    @Override
    public void visit(Infantryman infantryman) {
        System.out.println(prefix() + "- [Infantryman] " + infantryman.getName()
                + (infantryman.isAlive() ? " (alive)" : " (dead)"));
    }

    @Override
    public void visit(Horseman horseman) {
        System.out.println(prefix() + "- [Horseman] " + horseman.getName()
                + (horseman.isAlive() ? " (alive)" : " (dead)"));
    }

    @Override
    public void visit(SoldierGroup group) {
        System.out.println(prefix() + "[Group] " + group.getName());
        indent++;
        for (Soldier member : group.getMembers()) {
            member.accept(this);
        }
        indent--;
    }
}
