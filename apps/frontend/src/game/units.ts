import type { Cell } from "./cells";
import type { Job, JobKind } from "./jobs";

export type Faction = "colony" | "raiders";
export type Role = "worker" | "scout" | "warrior" | "queen";
export type SpawnRole = Exclude<Role, "queen">;
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
  worker: { hp: 8, bite: 1, speed: 1, jobs: ["build", "haul", "guard", "wander", "leave", "attack"] },
  scout: { hp: 10, bite: 1, speed: 3, jobs: ["forage", "haul", "attack", "wander", "leave"] },
  warrior: { hp: 24, bite: 4, speed: 2, jobs: ["attack", "wander", "leave"] },
  queen: { hp: 24, bite: 4, speed: 0.25, jobs: ["nest"] },
};
export const spawnCost: Record<SpawnRole, number> = { worker: 1, scout: 2, warrior: 3 };
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
