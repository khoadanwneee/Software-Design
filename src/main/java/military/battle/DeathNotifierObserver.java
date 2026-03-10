package military.battle;

import military.core.Soldier;

public class DeathNotifierObserver implements BattleObserver {
    private static DeathNotifierObserver instance;

    private DeathNotifierObserver() {
    }

    public static DeathNotifierObserver getInstance() {
        if (instance == null) {
            instance = new DeathNotifierObserver();
        }
        return instance;
    }

    @Override
    public void onSoldierDeath(Soldier soldier) {
        System.out.println("[DeathNotifier] " + soldier.getName() + " has fallen in battle.");
        System.out.println("[DeathNotifier] Sending condolence email for " + soldier.getName() + "...");
    }
}
