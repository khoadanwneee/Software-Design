package military;

import military.core.*;
import military.weaponry.*;
import military.weapons.medieval.*;

public class BattleTest {
    public static void main(String[] args) {
        // 1. Create our Protagonist (Infantryman)
        Soldier hero = new Infantryman();
        
        // 2. Equip him! (Order doesn't matter much here, but we layer them)
        hero = new MeleeEquipper(hero, new Sword());
        hero = new DefensiveEquipper(hero, new Shield());

        // 3. Create the Antagonist (Horseman)
        // Assuming Horseman has higher base stats
        Soldier enemy = new Horseman(); 

        System.out.println("--- BATTLE START: " + hero.getName() + " vs " + enemy.getName() + " ---");

        // Round 1: Hero attacks
        int heroDmg = hero.hit();
        enemy.wardOff(heroDmg);

        System.out.println("--------------------------------");

        // Round 2: Enemy counter-attacks
        int enemyDmg = enemy.hit();
        hero.wardOff(enemyDmg);

        System.out.println("--- BATTLE END ---");
        System.out.println("Hero Alive: " + hero.isAlive());
        System.out.println("Enemy Alive: " + enemy.isAlive());
    }
}