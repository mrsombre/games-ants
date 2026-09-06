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
  return !!a && !!b && (horizontal || (a === "corridor" && b === "corridor"));
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
  if (tool === "room" && roomSpan(colony, x, y).width > MAX_ROOM_WIDTH)
    return "Комната может быть шириной не больше 4 клеток";
  if (neighbors({ x, y }).some((neighbor) => connected(tool, colony[key(neighbor.x, neighbor.y)], neighbor.y === y)))
    return null;
  return tool === "corridor"
    ? "Коридор можно продолжить от коридора или начать сбоку от комнаты"
    : "Начни комнату сбоку от коридора или расширь существующую влево или вправо";
}
