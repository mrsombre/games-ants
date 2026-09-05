import type { BuildTool, Colony, Point } from "./colony";

export type MovingAnt = Point & {
  hp: number;
  attackWait: number;
  healWait: number;
  id: number;
  route: Point[];
  heading: number;
  wandering: boolean;
  wanderWait: number;
};
export type WorkerTask =
  | { kind: "build"; target: string; stand: Point }
  | { kind: "carry-egg"; eggId: number; destination: string; phase: "pickup" | "delivery" };
export type Worker = MovingAnt & { role: "worker"; task: WorkerTask | null; working: boolean };
export type Egg = { id: number; location: { cell: string } | { carrier: number } };
export type ScoutCargo = "apple" | "mushroom" | "caterpillar";
export type GameEvent =
  | { kind: "scout-delivered"; scoutId: number; cargo: ScoutCargo; food: number }
  | { kind: "attack-started"; count: number }
  | { kind: "attack-ended" }
  | { kind: "queen-died" };
export type Scout = MovingAnt & {
  role: "scout";
  phase: "home" | "outbound" | "away" | "returning";
  away: number;
  cargo: ScoutCargo | null;
};
export type Warrior = MovingAnt & { role: "warrior"; phase: "home" | "patrol" };
export type Ant = Worker | Scout | Warrior;
export type Role = Ant["role"];
export type Enemy = MovingAnt & { role: "enemy"; targetEggId: number | null };
export type Queen = Point & { role: "queen"; hp: number; attackWait: number; healWait: number; heading: number };
export type Creature = Ant | Enemy;
export type Blueprint = { tile: BuildTool; progress: number; workers: number };
export type Spawn = { eggId: number; cell: string; role: Role; progress: number };
export type Game = {
  queen: Queen;
  colony: Colony;
  blueprints: Record<string, Blueprint>;
  ants: Ant[];
  enemies: Enemy[];
  attackTimer: number;
  maxEnemies: number;
  raidsStarted: number;
  eggs: Egg[];
  eggTimer: number;
  nextEggId: number;
  spawns: Spawn[];
  food: number;
  nextId: number;
  revision: number;
  deliveries: number;
};

export const roles = {
  worker: { label: "Рабочий", cost: 1, color: 0xdca34e, size: 0.75, speed: 1.5, hp: 1 },
  scout: { label: "Разведчик", cost: 2, color: 0x87cbbb, size: 0.65, speed: 2.4, hp: 2 },
  warrior: { label: "Воин", cost: 3, color: 0xd47662, size: 1, speed: 1.5, hp: 3 },
};
export const scoutCargoFood: Record<ScoutCargo, number> = { apple: 1, mushroom: 1, caterpillar: 2 };
export const EGG_SECONDS = 30;
export const SPAWN_SECONDS = 10;
export const WANDER_MIN_SECONDS = 5;
export const WANDER_MAX_SECONDS = 30;
export const WARRIOR_SURFACE_CHANCE = 0.75;
export const buildSeconds = { corridor: 20, room: 30 };
export const HOME: Point = { x: 10, y: 2 };
export const ENTRANCE: Point = { x: 8, y: 0 };
export const SURFACE_EXIT: Point = { x: 8, y: -0.7 };
export const SIMULATION_STEP = 0.05;

export const enemyTraits = { color: 0xff7900, size: roles.warrior.size, speed: 1.5, hp: 3 };
export const ATTACK_MIN_SECONDS = 120;
export const ATTACK_MAX_SECONDS = 600;
export const MAX_ENEMIES = 5;
export const HIT_SECONDS = 0.5;

export const QUEEN_HP = 10;

export const HEAL_SECONDS = 10;
export const FIRST_RAID_MAX_ENEMIES = 2;
