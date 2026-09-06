import type { Cell } from "./cells";

export type Job =
  | { kind: "build"; target: string; stand: Cell }
  | { kind: "haul"; itemId: number; destination: Cell; phase: "pickup" | "delivery" }
  | { kind: "forage"; phase: "outbound" | "away" | "returning"; exit: Cell; remaining: number }
  | { kind: "attack"; targetId: number }
  | { kind: "guard"; destination: Cell }
  | { kind: "wander"; destination: Cell }
  | { kind: "leave"; destination: Cell }
  | { kind: "nest"; destination: Cell };
export type JobKind = Job["kind"];
