import type { Cell } from "./cells";
import type { Job, JobKind } from "./jobs";

export type Faction = "colony" | "raiders";
export type Role = "worker" | "scout" | "warrior" | "queen";
export type HatchRole = Exclude<Role, "queen">;
export type Unit = {
  readonly id: number;
  readonly faction: Faction;
  readonly role: Role;
  cell: Cell;
  hp: number;
  maxHp: number;
  bite: number;
  speed: number;
  route: Cell[];
  travel: number;
  heading: number;
  job: Job | null;
  working: boolean;
  idleWait: number;
  attackWait: number;
  healWait: number;
};
type Traits = { hp: number; bite: number; speed: number; jobs: readonly JobKind[] };
export const traits: Record<Role, Traits> = {
  worker: { hp: 1, bite: 1, speed: 1.5, jobs: ["build", "haul", "guard", "wander", "leave", "attack"] },
  scout: { hp: 2, bite: 1, speed: 2.4, jobs: ["forage", "haul", "attack", "leave"] },
  warrior: { hp: 3, bite: 1, speed: 1.5, jobs: ["attack", "wander", "leave"] },
  queen: { hp: 10, bite: 1, speed: 0, jobs: [] },
};
export const hatchCost: Record<HatchRole, number> = { worker: 1, scout: 2, warrior: 3 };
export function createUnit(id: number, role: Role, faction: Faction, cell: Cell): Unit {
  const { hp, bite, speed } = traits[role];
  return {
    id,
    role,
    faction,
    cell,
    hp,
    maxHp: hp,
    bite,
    speed,
    route: [],
    travel: 0,
    heading: 0,
    job: null,
    working: false,
    idleWait: 0,
    attackWait: 0,
    healWait: 0,
  };
}
export function present(unit: Unit) {
  return unit.hp > 0 && !(unit.job?.kind === "forage" && unit.job.phase === "away");
}
