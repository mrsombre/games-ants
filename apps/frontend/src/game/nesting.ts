import { type Cell, cellKey, ENTRANCE, point } from "./cells";
import { roomSpan } from "./colony";
import { layingInProgress } from "./eggs";
import { EPSILON, type Game, queenOf } from "./model";
import { type Navigation, setRoute } from "./navigation";
import type { Unit } from "./units";

export const NEST_SECONDS = 180;
export const NEST_ROOM_WIDTH = 3;
type Nest = { cells: Cell[]; seat: Cell; distance: number };

function rooms(game: Game, navigation: Navigation): Nest[] {
  const seen = new Set<string>();
  const nests: Nest[] = [];
  for (const [id, tile] of Object.entries(game.colony)) {
    if (tile !== "room" || seen.has(id)) continue;
    const { x, y } = point(id);
    const span = roomSpan(game.colony, x, y);
    const cells = Array.from({ length: span.width }, (_, i) => ({ x: span.left + i, y }));
    for (const cell of cells) seen.add(cellKey(cell));
    if (span.width < NEST_ROOM_WIDTH) continue;
    const distances = cells.flatMap((cell) => navigation.route(ENTRANCE, cell)?.length ?? []);
    if (distances.length !== cells.length) continue;
    const seat = cells[Math.floor((cells.length - 1) / 2)];
    if (seat) nests.push({ cells, seat, distance: Math.min(...distances) });
  }
  return nests;
}
function depth(game: Game, navigation: Navigation) {
  let farthest = 0;
  for (const id of Object.keys(game.colony))
    farthest = Math.max(farthest, navigation.route(ENTRANCE, point(id))?.length ?? 0);
  return farthest / 2;
}
export function nestCells(game: Game) {
  const queen = queenOf(game);
  if (!queen) return [];
  const homes = [queen.cell, ...(queen.job?.kind === "nest" ? [queen.job.destination] : [])];
  return homes.flatMap((home) => {
    if (game.colony[cellKey(home)] !== "room") return [home];
    const span = roomSpan(game.colony, home.x, home.y);
    return Array.from({ length: span.width }, (_, i) => ({ x: span.left + i, y: home.y }));
  });
}
export function chooseNest(game: Game, navigation: Navigation, queen: Unit): Cell | null {
  const nests = rooms(game, navigation);
  const middle = depth(game, navigation);
  const score = (nest: Nest) => Math.abs(nest.distance - middle);
  const current = nests.find((nest) => nest.cells.some((cell) => cellKey(cell) === cellKey(queen.cell)));
  let best = current ? score(current) : Number.POSITIVE_INFINITY;
  let choice: Nest | null = null;
  for (const nest of nests) {
    if (nest === current || score(nest) + EPSILON >= best) continue;
    best = score(nest);
    choice = nest;
  }
  return choice?.seat ?? null;
}
export function advanceNesting(game: Game, seconds: number, navigation: Navigation, engaged: ReadonlySet<number>) {
  const queen = queenOf(game);
  if (!queen || queen.hp <= 0) return;
  game.nestTimer = Math.min(NEST_SECONDS, game.nestTimer + seconds);
  if (queen.job || engaged.has(queen.id) || game.nestTimer + EPSILON < NEST_SECONDS) return;
  if (layingInProgress(game)) return;
  const seat = chooseNest(game, navigation, queen);
  const route = seat && navigation.from(queen, seat);
  if (!seat || !route) return;
  queen.job = { kind: "nest", destination: seat };
  setRoute(queen, route);
  game.eggTimer = 0;
}
