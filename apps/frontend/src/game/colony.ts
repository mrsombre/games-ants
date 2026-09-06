import { isCell, key, neighbors } from "./cells";

export const MAX_ROOM_WIDTH = 4;
export type Tile = "corridor" | "room";
export type BuildTool = Tile;
export type Tool = BuildTool | "demolish";
export type Colony = Record<string, Tile>;
export const isRoom = (tile: Tile | undefined) => tile === "room";
export const initialColony: Colony = {
  "8,1": "corridor",
  "8,2": "corridor",
  "8,3": "corridor",
  "8,4": "corridor",
  "8,5": "corridor",
  "6,2": "room",
  "7,2": "room",
  "9,3": "room",
  "10,3": "room",
  "11,3": "room",
};
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
export function placementError(colony: Colony, x: number, y: number, tool: BuildTool): string | null {
  if (!isCell(x, y)) return "Строй внутри подземной сетки";
  if (y <= 1) return "Верхний слой закрыт для строительства — вход уже готов";
  if (colony[key(x, y)]) return "Здесь уже построено";
  const besideCorridor = neighbors({ x, y }).some((neighbor) => colony[key(neighbor.x, neighbor.y)] === "corridor");
  if (tool === "corridor") return besideCorridor ? null : "Коридор можно продолжить только от коридора";
  const expanding = isRoom(colony[key(x - 1, y)]) || isRoom(colony[key(x + 1, y)]);
  if (roomSpan(colony, x, y).width > MAX_ROOM_WIDTH) return "Комната может быть шириной не больше 4 клеток";
  if (!expanding && !besideCorridor) return "Начни комнату у коридора или расширь существующую влево или вправо";
  return null;
}
