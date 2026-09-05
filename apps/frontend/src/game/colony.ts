export const COLS = 18;
export const ROWS = 10;
export type Tile = "corridor" | "room" | "queen";
export type Tool = "corridor" | "room";
export type Colony = Record<string, Tile>;
export const key = (x: number, y: number) => `${x},${y}`;
export const initialColony: Colony = {
  "8,0": "corridor",
  "8,1": "corridor",
  "8,2": "corridor",
  "7,2": "queen",
  "6,2": "room",
  "9,2": "room",
};
export function placementError(colony: Colony, x: number, y: number): string | null {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return "Строй внутри подземной сетки";
  if (colony[key(x, y)]) return "Здесь уже построено";
  if (
    ![
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].some(([a = NaN, b = NaN]) => colony[key(a, b)])
  )
    return "Начни рядом с комнатой или коридором";
  return null;
}
