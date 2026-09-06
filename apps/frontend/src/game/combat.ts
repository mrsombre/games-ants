import { cellKey } from "./cells";
import { EPSILON } from "./model";
import { present, type Unit } from "./units";

export const HIT_SECONDS = 1;
export const HEAL_SECONDS = 2;
export function contacts(units: readonly Unit[]) {
  const cells = new Map<string, Map<Unit["faction"], Unit>>();
  for (const unit of units) {
    if (!present(unit)) continue;
    const id = cellKey(unit.cell);
    const factions = cells.get(id) ?? new Map<Unit["faction"], Unit>();
    const first = factions.get(unit.faction);
    if (!first || unit.id < first.id) factions.set(unit.faction, unit);
    cells.set(id, factions);
  }
  const targets = new Map<number, Unit>();
  for (const unit of units) {
    if (!present(unit)) continue;
    const target = cells.get(cellKey(unit.cell))?.get(unit.faction === "colony" ? "raiders" : "colony");
    if (target) targets.set(unit.id, target);
  }
  return targets;
}
export function fight(units: readonly Unit[], seconds: number, targets = contacts(units)) {
  const damage = new Map<Unit, number>();
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    const target = targets.get(unit.id);
    if (!target) {
      unit.attackWait = 0;
      if (unit.hp >= unit.maxHp) unit.healWait = 0;
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
