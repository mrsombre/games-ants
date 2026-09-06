export type Cell = Readonly<{ x: number; y: number }>;
export type CellId = `${number},${number}`;

export const COLS = 18;
export const ROWS = 11;
export const ENTRANCE: Cell = { x: 8, y: 1 };
export const EXIT: Cell = { x: -1, y: 0 };
export const HOME: Cell = { x: 10, y: 3 };
export const key = (x: number, y: number): CellId => `${x},${y}`;
export const cellKey = (cell: Cell) => key(cell.x, cell.y);
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export function point(id: string): Cell {
  const [x, y] = id.split(",").map(Number);
  if (x === undefined || y === undefined || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`Invalid cell: ${id}`);
  }
  return { x, y };
}
export const neighbors = ({ x, y }: Cell): Cell[] => [
  { x: x - 1, y },
  { x: x + 1, y },
  { x, y: y - 1 },
  { x, y: y + 1 },
];
export function isCell(x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
}
