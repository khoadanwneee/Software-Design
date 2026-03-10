package military.battle;

import military.core.Soldier;

public class DeathCountObserver implements BattleObserver {
    private static DeathCountObserver instance;
    private int deathCount = 0;

    private DeathCountObserver() {
    }

    public static DeathCountObserver getInstance() {
        if (instance == null) {
            instance = new DeathCountObserver();
        }
        return instance;
    }

    @Override
    public void onSoldierDeath(Soldier soldier) {
        deathCount++;
        System.out.println("[DeathCount] Total deaths so far: " + deathCount);
    }

    public int getDeathCount() {
        return deathCount;
    }
}
