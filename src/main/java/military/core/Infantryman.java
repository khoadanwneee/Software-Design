package military.core;

public class Infantryman implements Soldier {
    private static int counter = 0;

    private final String name;
    private int hp;
    private final int attackPower;

    public Infantryman() {
        this.name = "Infantryman #" + (++counter);
        this.hp = 100;
        this.attackPower = 10;
    }

    @Override
    public int hit() {
        if (!isAlive()) return 0;
        System.out.println(name + " attacks with power " + attackPower);
        return attackPower;
    }

    @Override
    public boolean wardOff(int strength) {
        if (!isAlive()) return false;
        hp -= strength;
        System.out.println(name + " receives " + strength + " damage, HP: " + Math.max(hp, 0));
        return isAlive();
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public boolean isAlive() {
        return hp > 0;
    }
}
