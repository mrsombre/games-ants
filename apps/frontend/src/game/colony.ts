import { isCell, key, neighbors } from "./cells";

export const MAX_ROOM_WIDTH = 4;
export type RoomTile = "nest" | "storage";
export type Tile = "corridor" | RoomTile;
export type BuildTool = Tile;
export type Colony = Record<string, Tile>;
export const isRoom = (tile: Tile | undefined): tile is RoomTile => tile === "nest" || tile === "storage";
export const initialColony: Colony = {
  "8,1": "corridor",
  "8,2": "corridor",
  "8,3": "corridor",
  "8,4": "corridor",
  "8,5": "corridor",
  "6,2": "storage",
  "7,2": "storage",
  "9,3": "nest",
  "10,3": "nest",
  "11,3": "nest",
};
export function connected(a: Tile | undefined, b: Tile | undefined, horizontal: boolean) {
  return !!a && !!b && (horizontal || (a === "corridor" && b === "corridor"));
}

export function roomSpan(colony: Colony, x: number, y: number, tile: Tile | undefined = colony[key(x, y)]) {
  let left = x,
    right = x;
  while (isRoom(tile) && colony[key(left - 1, y)] === tile) left--;
  while (isRoom(tile) && colony[key(right + 1, y)] === tile) right++;
  return { left, right, width: right - left + 1 };
}
export function placementError(colony: Colony, x: number, y: number, tool: BuildTool): string | null {
  if (!isCell(x, y)) return "Строй внутри подземной сетки";
  if (y <= 1) return "Верхний слой закрыт для строительства — вход уже готов";
  if (colony[key(x, y)]) return "Здесь уже построено";
  if (isRoom(tool)) {
    if (roomSpan(colony, x, y, tool).width > MAX_ROOM_WIDTH) return "Комната может быть шириной не больше 4 клеток";
    const beside = [colony[key(x - 1, y)], colony[key(x + 1, y)]];
    if (beside.some((tile) => isRoom(tile) && tile !== tool)) return "Гнездо и склад разделяет коридор";
  }
  if (neighbors({ x, y }).some((neighbor) => connected(tool, colony[key(neighbor.x, neighbor.y)], neighbor.y === y)))
    return null;
  return tool === "corridor"
    ? "Коридор можно продолжить от коридора или начать сбоку от комнаты"
    : "Начни комнату сбоку от коридора или расширь такую же влево или вправо";
}
