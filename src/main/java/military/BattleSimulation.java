package military;

import military.proxy.SoldierProxy;
import military.organization.SoldierGroup;
import military.visitor.*;
import military.battle.*;
import military.factory.*;

/**
 * BattleSimulation demonstrates all design patterns working together:
 * - Abstract Factory: Create generation-specific armies
 * - Decorator: Layer equipment on soldiers (with durability)
 * - Proxy: Manage equipment constraints
 * - Composite: Organize hierarchical armies
 * - Visitor: Inspect and count units without modifying classes
 * - Observer: Track battle events in real-time
 * - Singleton: Ensure single death counter instance
 */
public class BattleSimulation {

    public static void main(String[] args) {
        System.out.println("===============================================");
        System.out.println("   THREE-FACTION BATTLE TOURNAMENT");
        System.out.println("===============================================\n");

        // ===== SETUP: Observers (Singleton Pattern) =====
        System.out.println(">>> INITIALIZING BATTLE SYSTEM");
        BattleSubject battleSubject = new BattleSubject();
        DeathCountObserver deathCounter = DeathCountObserver.getInstance();
        DeathNotifierObserver deathNotifier = DeathNotifierObserver.getInstance();
        battleSubject.attach(deathCounter);
        battleSubject.attach(deathNotifier);
        System.out.println("✓ Death Counter Observer (Singleton): " + deathCounter.getClass().getSimpleName());
        System.out.println("✓ Death Notifier Observer (Singleton): " + deathNotifier.getClass().getSimpleName() + "\n");

        // ===== SETUP: Create Medieval Army (Abstract Factory) =====
        System.out.println(">>> CREATING MEDIEVAL ARMY (Abstract Factory Pattern)");
        ArmyFactory medievalFactory = new MedievalFactory();

        // Medieval Infantry Squad: Infantryman with Sword + Shield
        SoldierProxy medievalInfantry1 = new SoldierProxy(medievalFactory.createInfantryman());
        medievalInfantry1.addSword();      // Adds MedievalSword decorator (attack +8)
        medievalInfantry1.addShield();     // Adds MedievalArmor decorator (defense +6)

        SoldierProxy medievalInfantry2 = new SoldierProxy(medievalFactory.createInfantryman());
        medievalInfantry2.addSword();
        medievalInfantry2.addShield();

        // Medieval Cavalry: Horseman with Shield only
        SoldierProxy medievalCavalry = new SoldierProxy(medievalFactory.createHorseman());
        medievalCavalry.addShield();       // Enhanced defense for mounted unit

        // Organize into Medieval Infantry Squad (Composite)
        SoldierGroup medievalInfantrySquad = new SoldierGroup("Medieval Infantry Squad");
        medievalInfantrySquad.addSoldier(medievalInfantry1);
        medievalInfantrySquad.addSoldier(medievalInfantry2);

        // Create Medieval Army (top-level group)
        SoldierGroup medievalArmy = new SoldierGroup("Medieval Kingdom Army");
        medievalArmy.addSoldier(medievalInfantrySquad);
        medievalArmy.addSoldier(medievalCavalry);

        System.out.println("✓ Medieval Army created with nested groups\n");

        // ===== SETUP: Create World War Army (Abstract Factory) =====
        System.out.println(">>> CREATING WORLD WAR ARMY (Abstract Factory Pattern)");
        ArmyFactory worldWarFactory = new WorldWarFactory();

        // World War Infantry: Infantryman with Rifle + Helmet
        SoldierProxy wwInfantry1 = new SoldierProxy(worldWarFactory.createInfantryman());
        wwInfantry1.addSword();    // Adds WorldWarRifle (attack +20)
        wwInfantry1.addShield();   // Adds WorldWarHelmet (defense +10)

        SoldierProxy wwInfantry2 = new SoldierProxy(worldWarFactory.createInfantryman());
        wwInfantry2.addSword();
        wwInfantry2.addShield();

        // World War Cavalry: Horseman with Helmet only (higher HP: 250)
        SoldierProxy wwCavalry = new SoldierProxy(worldWarFactory.createHorseman());
        wwCavalry.addShield();

        // Organize into WW Army (Composite)
        SoldierGroup wwArmy = new SoldierGroup("Allied Forces Army");
        wwArmy.addSoldier(wwInfantry1);
        wwArmy.addSoldier(wwInfantry2);
        wwArmy.addSoldier(wwCavalry);

        System.out.println("✓ World War Army created with hierarchical structure\n");

        // ===== SETUP: Create SciFi Army (Abstract Factory) =====
        System.out.println(">>> CREATING SCIFI ARMY (Abstract Factory Pattern)");
        ArmyFactory sciFiFactory = new SciFiFactory();

        // SciFi Infantry: Infantryman with Laser Sword + Nano Armor
        SoldierProxy sciFiInfantry1 = new SoldierProxy(sciFiFactory.createInfantryman());
        sciFiInfantry1.addSword();      // Adds SciFiLaserSword (attack +35, durability 6)
        sciFiInfantry1.addShield();     // Adds SciFiNanoArmor (defense +20, durability 6)

        SoldierProxy sciFiInfantry2 = new SoldierProxy(sciFiFactory.createInfantryman());
        sciFiInfantry2.addSword();
        sciFiInfantry2.addShield();

        // SciFi Cavalry: Horseman with Nano Armor only
        SoldierProxy sciFiCavalry = new SoldierProxy(sciFiFactory.createHorseman());
        sciFiCavalry.addShield();

        // Organize into SciFi Army (Composite)
        SoldierGroup sciFiArmy = new SoldierGroup("Advanced SciFi Legion");
        sciFiArmy.addSoldier(sciFiInfantry1);
        sciFiArmy.addSoldier(sciFiInfantry2);
        sciFiArmy.addSoldier(sciFiCavalry);

        System.out.println("✓ SciFi Army created with advanced weaponry\n");

        // ===== DISPLAY: Initial Army Status (Visitor Pattern) =====
        System.out.println(">>> ARMY STATUS BEFORE TOURNAMENT (Visitor Pattern - DisplayVisitor)");
        DisplayVisitor displayVisitor = new DisplayVisitor();

        System.out.println("\n--- Medieval Kingdom Army Structure ---");
        medievalArmy.accept(displayVisitor);

        System.out.println("\n--- Allied Forces Army Structure ---");
        wwArmy.accept(displayVisitor);

        System.out.println("\n--- SciFi Legion Army Structure ---");
        sciFiArmy.accept(displayVisitor);

        // ===== COUNT: Soldier units (Visitor Pattern) =====
        System.out.println("\n>>> UNIT COUNT ANALYSIS (Visitor Pattern - CountVisitor)");
        CountVisitor countVisitor = new CountVisitor();

        medievalArmy.accept(countVisitor);
        System.out.println("Medieval Army: " + countVisitor.getInfantryCount() + " Infantrymen, "
                + countVisitor.getHorsemanCount() + " Horsemen (Total: "
                + (countVisitor.getInfantryCount() + countVisitor.getHorsemanCount()) + ")");

        CountVisitor countVisitor2 = new CountVisitor();
        wwArmy.accept(countVisitor2);
        System.out.println("Allied Army: " + countVisitor2.getInfantryCount() + " Infantrymen, "
                + countVisitor2.getHorsemanCount() + " Horsemen (Total: "
                + (countVisitor2.getInfantryCount() + countVisitor2.getHorsemanCount()) + ")");

        CountVisitor countVisitor3 = new CountVisitor();
        sciFiArmy.accept(countVisitor3);
        System.out.println("SciFi Army: " + countVisitor3.getInfantryCount() + " Infantrymen, "
                + countVisitor3.getHorsemanCount() + " Horsemen (Total: "
                + (countVisitor3.getInfantryCount() + countVisitor3.getHorsemanCount()) + ")\n");

        // ===== TOURNAMENT BRACKET =====
        System.out.println("===============================================");
        System.out.println("   TOURNAMENT BRACKET");
        System.out.println("===============================================");
        System.out.println("ROUND 1: Medieval Kingdom vs Allied Forces");
        System.out.println("ROUND 2: Winner vs SciFi Legion\n");

        // ===== ROUND 1: Medieval vs World War =====
        System.out.println("===============================================");
        System.out.println("   ROUND 1: MEDIEVAL vs WORLD WAR");
        System.out.println("===============================================\n");

        SoldierGroup round1Winner = conductBattle(medievalArmy, wwArmy, "Medieval Kingdom", "Allied Forces", 20);

        // ===== ROUND 2: Winner vs SciFi =====
        System.out.println("\n===============================================");
        System.out.println("   ROUND 2: " + round1Winner.getName().toUpperCase() + " vs SCIFI LEGION");
        System.out.println("===============================================\n");

        SoldierGroup tournament1Winner = conductBattle(round1Winner, sciFiArmy, round1Winner.getName(), "SciFi Legion", 20);

        // ===== TOURNAMENT RESULTS =====
        System.out.println("\n===============================================");
        System.out.println("   TOURNAMENT FINAL RESULTS");
        System.out.println("===============================================\n");

        System.out.println("Total casualties across all battles: " + deathCounter.getDeathCount());

        if (tournament1Winner.getName().equals("Medieval Kingdom Army")) {
            System.out.println("\n[TOURNAMENT CHAMPION] Medieval Kingdom Army");
        } else if (tournament1Winner.getName().equals("Allied Forces Army")) {
            System.out.println("\n[TOURNAMENT CHAMPION] Allied Forces Army");
        } else if (tournament1Winner.getName().equals("Advanced SciFi Legion")) {
            System.out.println("\n[TOURNAMENT CHAMPION] Advanced SciFi Legion");
        }

        // ===== FINAL SURVIVOR INSPECTION =====
        System.out.println("\n>>> TOURNAMENT CHAMPION STATUS (Visitor Pattern - Final)");
        System.out.println("\n--- " + tournament1Winner.getName() + " (Survivors) ---");
        tournament1Winner.accept(displayVisitor);

        System.out.println("\n===============================================");
        System.out.println("   TOURNAMENT SIMULATION COMPLETE");
        System.out.println("===============================================");
    }

    /**
     * Conducts a single battle between two armies until one is eliminated.
     * @param army1 First combatant
     * @param army2 Second combatant
     * @param name1 Name of first army for display
     * @param name2 Name of second army for display
     * @param maxRounds Maximum rounds to prevent infinite loops
     * @return The surviving army
     */
    private static SoldierGroup conductBattle(SoldierGroup army1, SoldierGroup army2, 
                                              String name1, String name2, int maxRounds) {
        int round = 1;

        // Battle loop - continue until one side is eliminated
        while (army1.isAlive() && army2.isAlive() && round <= maxRounds) {
            System.out.println("====================================================");
            System.out.println("  ROUND " + String.format("%2d", round));
            System.out.println("====================================================");

            // Army 1 attacks Army 2
            System.out.println("\n> " + name1.toUpperCase() + " ATTACK PHASE:");
            int damage1 = army1.hit();
            System.out.println("  [" + name1 + " Total Damage: " + damage1 + "]\n");

            boolean army2StillAlive = army2.wardOff(damage1);

            if (!army2StillAlive) {
                System.out.println("\n  X " + name2.toUpperCase() + " DEFEATED!");
                return army1;
            }

            // Army 2 attacks Army 1
            System.out.println("\n> " + name2.toUpperCase() + " ATTACK PHASE:");
            int damage2 = army2.hit();
            System.out.println("  [" + name2 + " Total Damage: " + damage2 + "]\n");

            boolean army1StillAlive = army1.wardOff(damage2);

            if (!army1StillAlive) {
                System.out.println("\n  X " + name1.toUpperCase() + " DEFEATED!");
                return army2;
            }

            System.out.println("  * Equipment durability decreasing with each use...");
            System.out.println("  (After 3 uses, equipment loses effectiveness)\n");

            round++;
        }

        if (round > maxRounds) {
            System.out.println("\n⚠ Battle reached maximum rounds - determining winner...");
            if (!army1.isAlive()) {
                return army2;
            } else if (!army2.isAlive()) {
                return army1;
            } else {
                // Both still alive - return army with more survivors
                return army1;
            }
        }

        return army1.isAlive() ? army1 : army2;
    }
}
