import { cellKey, EXIT } from "./cells";
import { EPSILON, type Game, homeOf } from "./model";
import { type Navigation, setRoute } from "./navigation";
import { type Faction, present, type Stance, traits, type Unit } from "./units";
import { interruptJob } from "./work";

export const HIT_SECONDS = 1;
export const HEAL_SECONDS = 2;
export const FRONT_LIMIT = 2;
export type Contact = { targets: Map<number, Unit>; blocked: Set<number> };
export function stanceOf(unit: Unit): Stance {
  return unit.fleeing ? "evade" : traits[unit.role].stance;
}
function enemyOf(faction: Faction): Faction {
  return faction === "colony" ? "raiders" : "colony";
}
type Side = { fighters: Unit[]; evaders: Unit[] };
function side(units: readonly Unit[]): Side {
  return {
    fighters: units.filter((unit) => stanceOf(unit) === "fight"),
    evaders: units.filter((unit) => stanceOf(unit) === "evade"),
  };
}
export function contacts(units: readonly Unit[]): Contact {
  const cells = new Map<string, Record<Faction, Unit[]>>();
  for (const unit of [...units].sort((a, b) => a.id - b.id)) {
    if (!present(unit)) continue;
    const id = cellKey(unit.cell);
    const factions = cells.get(id) ?? { colony: [], raiders: [] };
    factions[unit.faction].push(unit);
    cells.set(id, factions);
  }
  const targets = new Map<number, Unit>();
  const blocked = new Set<number>();
  for (const factions of cells.values()) {
    if (!factions.colony.length || !factions.raiders.length) continue;
    const sides = { colony: side(factions.colony), raiders: side(factions.raiders) };
    for (const faction of ["colony", "raiders"] as const) {
      const own = sides[faction];
      const enemy = sides[enemyOf(faction)];
      for (const unit of own.fighters) blocked.add(unit.id);
      const front = own.fighters.slice(0, FRONT_LIMIT);
      const reachable = [...enemy.fighters, ...enemy.evaders];
      for (const [index, target] of reachable.entries())
        for (const [slot, unit] of front.entries()) if (slot % reachable.length === index) targets.set(unit.id, target);
    }
  }
  return { targets, blocked };
}
export function fight(units: readonly Unit[], seconds: number, contact = contacts(units)) {
  const damage = new Map<Unit, number>();
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    const target = contact.targets.get(unit.id);
    if (!target) {
      unit.attackWait = 0;
      if (unit.hp >= unit.maxHp || contact.blocked.has(unit.id)) unit.healWait = 0;
      else {
        unit.healWait += seconds;
        if (unit.healWait + EPSILON >= HEAL_SECONDS) {
          unit.hp = Math.min(unit.maxHp, unit.hp + 1);
          unit.healWait = unit.hp === unit.maxHp ? 0 : Math.max(0, unit.healWait - HEAL_SECONDS);
        }
      }
      continue;
    }
    unit.healWait = 0;
    unit.attackWait += seconds;
    if (unit.attackWait + EPSILON < HIT_SECONDS) continue;
    unit.attackWait = Math.max(0, unit.attackWait - HIT_SECONDS);
    damage.set(target, (damage.get(target) ?? 0) + unit.bite);
  }
  for (const [unit, amount] of damage) unit.hp = Math.max(0, unit.hp - amount);
}
export function retreat(game: Game, navigation: Navigation) {
  for (const unit of game.units) {
    if (unit.hp <= 0) continue;
    if (unit.fleeing) {
      if (unit.hp < unit.maxHp) continue;
      unit.fleeing = false;
      if (unit.job?.kind === "flee") unit.job = null;
      continue;
    }
    if (unit.hp >= unit.maxHp * traits[unit.role].flee) continue;
    unit.fleeing = true;
    interruptJob(game, unit);
    const destination = unit.faction === "colony" ? homeOf(game) : EXIT;
    unit.job = { kind: "flee", destination };
    const route = navigation.from(unit, destination);
    if (route) setRoute(unit, route);
  }
}
