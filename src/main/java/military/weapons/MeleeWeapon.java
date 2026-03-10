package military.weapons;

public abstract class MeleeWeapon {
    private String name;
    private int bonusDamage;

    public MeleeWeapon(String name, int bonusDamage) {
        this.name = name;
        this.bonusDamage = bonusDamage;
    }

    public String getName() { return name; }
    public int getBonusDamage() { return bonusDamage; }
}
