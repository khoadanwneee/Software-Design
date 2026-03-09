package military.core;

public interface Soldier {
    int hit();
    boolean wardOff(int strength);
    String getName();
    boolean isAlive();
}
