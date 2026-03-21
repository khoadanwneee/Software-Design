package military.organization;

import military.core.Soldier;
import military.visitor.SoldierVisitor;

import java.util.ArrayList;
import java.util.List;

public class SoldierGroup implements Soldier {
    private final String name;
    private final List<Soldier> members = new ArrayList<>();

    public SoldierGroup(String name) {
        this.name = name;
    }

    public void addSoldier(Soldier soldier) {
        members.add(soldier);
    }

    public void removeSoldier(Soldier soldier) {
        members.remove(soldier);
    }

    public List<Soldier> getMembers() {
        return members;
    }

    @Override
    public int hit() {
        int total = 0;
        for (Soldier s : members) {
            if (s.isAlive()) {
                total += s.hit();
            }
        }
        System.out.println("[Group] " + name + " total attack: " + total);
        return total;
    }

    @Override
    public boolean wardOff(int strength) {
        List<Soldier> alive = new ArrayList<>();
        for (Soldier s : members) {
            if (s.isAlive()) {
                alive.add(s);
            }
        }
        if (alive.isEmpty())
            return false;

        int damageEach = strength / alive.size();
        int remainder = strength % alive.size();

        System.out.println("[Group] " + name + " distributes " + strength
                + " damage among " + alive.size() + " members (" + damageEach + " each)");

        for (int i = 0; i < alive.size(); i++) {
            int dmg = damageEach + (i < remainder ? 1 : 0);
            alive.get(i).wardOff(dmg);
        }
        return isAlive();
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public boolean isAlive() {
        for (Soldier s : members) {
            if (s.isAlive())
                return true;
        }
        return false;
    }

    @Override
    public void accept(SoldierVisitor visitor) {
        visitor.visit(this);
    }
}
