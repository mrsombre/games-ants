import type { BuildTool, Colony, Point } from "./colony";

type MovingAnt = Point & {
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
export type Scout = MovingAnt & {
  role: "scout";
  phase: "home" | "outbound" | "away" | "returning";
  away: number;
  cargo: ScoutCargo | null;
};
export type Warrior = MovingAnt & { role: "warrior"; phase: "home" | "patrol" };
export type Ant = Worker | Scout | Warrior;
export type Role = Ant["role"];
export type Blueprint = { tile: BuildTool; progress: number; workers: number };
export type Spawn = { eggId: number; cell: string; role: Role; progress: number };
export type Game = {
  colony: Colony;
  blueprints: Record<string, Blueprint>;
  ants: Ant[];
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
  worker: { label: "Рабочий", cost: 1, color: 0xdca34e, size: 0.75, speed: 1.5 },
  scout: { label: "Разведчик", cost: 2, color: 0x87cbbb, size: 0.65, speed: 2.4 },
  warrior: { label: "Воин", cost: 3, color: 0xd47662, size: 1, speed: 1.5 },
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
