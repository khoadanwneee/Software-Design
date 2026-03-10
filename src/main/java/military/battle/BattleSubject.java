package military.battle;

import military.core.Soldier;

import java.util.ArrayList;
import java.util.List;

public class BattleSubject {
    private final List<BattleObserver> observers = new ArrayList<>();

    public void attach(BattleObserver observer) {
        observers.add(observer);
    }

    public void detach(BattleObserver observer) {
        observers.remove(observer);
    }

    public void notifyDeath(Soldier soldier) {
        for (BattleObserver observer : observers) {
            observer.onSoldierDeath(soldier);
        }
    }
}
