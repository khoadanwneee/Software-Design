package military.battle;

import military.core.Soldier;

public interface BattleObserver {
    void onSoldierDeath(Soldier soldier);
}
