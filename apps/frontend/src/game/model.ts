import type { Colony, Point, Tool } from "./colony";

type MovingAnt = Point & { id: number; route: Point[]; heading: number };
export type Worker = MovingAnt & { role: "worker"; target: string | null; working: boolean };
export type Scout = MovingAnt & {
  role: "scout";
  phase: "home" | "outbound" | "away" | "returning";
  away: number;
  cargo: number;
};
export type Warrior = MovingAnt & { role: "warrior"; phase: "home" | "patrol" };
export type Ant = Worker | Scout | Warrior;
export type Role = Ant["role"];
export type Blueprint = { tile: Tool; progress: number; workers: number };
export type Game = {
  colony: Colony;
  blueprints: Record<string, Blueprint>;
  ants: Ant[];
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
export const buildSeconds = { corridor: 20, room: 30 };
export const HOME: Point = { x: 10, y: 2 };
export const ENTRANCE: Point = { x: 8, y: 0 };
export const SURFACE_EXIT: Point = { x: 8, y: -0.7 };
export const SIMULATION_STEP = 0.05;
