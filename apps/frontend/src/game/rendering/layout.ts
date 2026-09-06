import { type Cell, COLS, ROWS } from "../cells";

export const CELL = 52;
export const WIDTH = COLS * CELL;
export const GROUND = 260;
export const SURFACE = GROUND - CELL;
export const HORIZON = SURFACE + CELL / 2 + 10;
export const HEIGHT = SURFACE + ROWS * CELL + 24;
export const screenCell = (x: number, y: number): Cell => ({
  x: Math.floor(x / CELL),
  y: Math.floor((y - SURFACE) / CELL),
});
