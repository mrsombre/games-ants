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
const SAVE_KEY = "games-ants.colony.v1";
export function loadColony(): Colony {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ...initialColony };
    const entries = Object.entries(data);
    if (
      !entries.every(([position, tile]) => {
        const [x = NaN, y = NaN] = position.split(",").map(Number);
        return (
          position === key(x, y) &&
          Number.isInteger(x) &&
          Number.isInteger(y) &&
          x >= 0 &&
          x < COLS &&
          y >= 0 &&
          y < ROWS &&
          ["corridor", "room", "queen"].includes(tile)
        );
      })
    )
      return { ...initialColony };
    if (!Object.entries(initialColony).every(([position, tile]) => (data as Colony)[position] === tile))
      return { ...initialColony };
    const connected = new Set(["8,0"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [position] of entries) {
        const [x = NaN, y = NaN] = position.split(",").map(Number);
        if (
          !connected.has(position) &&
          [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ].some(([a = NaN, b = NaN]) => connected.has(key(a, b)))
        ) {
          connected.add(position);
          changed = true;
        }
      }
    }
    return connected.size === entries.length ? (data as Colony) : { ...initialColony };
  } catch {
    return { ...initialColony };
  }
}
export function saveColony(colony: Colony): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(colony));
    return true;
  } catch {
    return false;
  }
}
