package military.weapons;

public abstract class DefensiveWeapon {
    private String name;
    private int wardBonus;
    public DefensiveWeapon(String name, int wardBonus) {
        this.name = name;
        this.wardBonus = wardBonus;
    }

    public String getName() { return name; }
    public int getWardBonus() { return wardBonus; }
}
