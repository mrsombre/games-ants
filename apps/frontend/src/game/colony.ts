export type Point = { x: number; y: number };

export const COLS = 18;
export const ROWS = 10;
export const MAX_ROOM_WIDTH = 4;
export type Tile = "corridor" | "room" | "queen";
export type BuildTool = "corridor" | "room";
export type Tool = BuildTool | "demolish";
export type Colony = Record<string, Tile>;
export const key = (x: number, y: number) => `${x},${y}`;
export const isRoom = (tile: Tile | undefined) => tile === "room" || tile === "queen";
export const initialColony: Colony = {
  "8,0": "corridor",
  "8,1": "corridor",
  "8,2": "corridor",
  "8,3": "corridor",
  "8,4": "corridor",
  "6,1": "room",
  "7,1": "room",
  "9,2": "room",
  "10,2": "queen",
  "11,2": "room",
};
export const point = (position: string): Point => {
  const comma = position.indexOf(",");
  return { x: Number(position.slice(0, comma)), y: Number(position.slice(comma + 1)) };
};
export const neighbors = ({ x, y }: Point) => [
  { x: x - 1, y },
  { x: x + 1, y },
  { x, y: y - 1 },
  { x, y: y + 1 },
];
export function connected(a: Tile | undefined, b: Tile | undefined, horizontal: boolean) {
  return !!a && !!b && (a === "corridor" || b === "corridor" || horizontal);
}

export function roomSpan(colony: Colony, x: number, y: number) {
  let left = x,
    right = x;
  while (isRoom(colony[key(left - 1, y)])) left--;
  while (isRoom(colony[key(right + 1, y)])) right++;
  return { left, right, width: right - left + 1 };
}
export function roomCount(colony: Colony) {
  return Object.entries(colony).filter(([position, tile]) => {
    const { x, y } = point(position);
    return isRoom(tile) && !isRoom(colony[key(x - 1, y)]);
  }).length;
}
export function isCell(x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
}
export function placementError(colony: Colony, x: number, y: number, tool: BuildTool): string | null {
  if (!isCell(x, y)) return "Строй внутри подземной сетки";
  if (y === 0) return "Верхний слой закрыт для строительства — вход уже готов";
  if (colony[key(x, y)]) return "Здесь уже построено";
  const besideCorridor = neighbors({ x, y }).some((neighbor) => colony[key(neighbor.x, neighbor.y)] === "corridor");
  if (tool === "corridor") return besideCorridor ? null : "Коридор можно продолжить только от коридора";
  const expanding = isRoom(colony[key(x - 1, y)]) || isRoom(colony[key(x + 1, y)]);
  if (roomSpan(colony, x, y).width > MAX_ROOM_WIDTH) return "Комната может быть шириной не больше 4 клеток";
  if (!expanding && !besideCorridor) return "Начни комнату у коридора или расширь существующую влево или вправо";
  return null;
}
