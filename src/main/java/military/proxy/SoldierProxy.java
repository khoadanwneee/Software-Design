package military.proxy;

import military.core.Soldier;
import military.equipment.ShieldDecorator;
import military.equipment.SwordDecorator;
import military.visitor.SoldierVisitor;

import java.util.HashSet;
import java.util.Set;

public class SoldierProxy implements Soldier {
    private Soldier soldier;
    private final Set<String> equippedTypes = new HashSet<>();

    public SoldierProxy(Soldier soldier) {
        this.soldier = soldier;
    }

    public boolean addShield() {
        return addEquipment("Shield");
    }

    public boolean addSword() {
        return addEquipment("Sword");
    }

    private boolean addEquipment(String type) {
        if (equippedTypes.contains(type)) {
            System.out.println("[Proxy] " + getName() + " already has a " + type + " — rejected.");
            return false;
        }
        equippedTypes.add(type);
        switch (type) {
            case "Shield":
                soldier = new ShieldDecorator(soldier);
                break;
            case "Sword":
                soldier = new SwordDecorator(soldier);
                break;
            default:
                equippedTypes.remove(type);
                System.out.println("[Proxy] Unknown equipment type: " + type);
                return false;
        }
        System.out.println("[Proxy] " + getName() + " equipped with " + type);
        return true;
    }

    @Override
    public int hit() {
        return soldier.hit();
    }

    @Override
    public boolean wardOff(int strength) {
        return soldier.wardOff(strength);
    }

    @Override
    public String getName() {
        return soldier.getName();
    }

    @Override
    public boolean isAlive() {
        return soldier.isAlive();
    }

    @Override
    public void accept(SoldierVisitor visitor) {
        soldier.accept(visitor);
    }
}
