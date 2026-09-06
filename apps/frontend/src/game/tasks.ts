import { type Cell, COLS, cellKey, ENTRANCE, EXIT, neighbors, point, sameCell } from "./cells";
import { connected } from "./colony";
import { MAX_BUILDERS } from "./construction";
import { eggStorageCells, queenCells } from "./eggs";
import { isFlooded } from "./flood";
import { canCarry, itemReserved } from "./items";
import type { Job } from "./jobs";
import { type Game, homeOf } from "./model";
import { forageAllowed } from "./narrator";
import { type Navigation, setRoute } from "./navigation";
import { spawnClaimed } from "./spawning";
import { foodStorageCells, storageCapacity } from "./storage";
import { type Faction, isSurface, present, traits, type Unit } from "./units";

export const WANDER_MIN_SECONDS = 5;
export const WANDER_MAX_SECONDS = 30;
export const WARRIOR_SURFACE_CHANCE = 0.75;
// Row 0 hangs on the nest by the single edge (8,0) - (8,1), so a surface unit posts above it.
export const SURFACE_POST: Cell = { x: ENTRANCE.x, y: 0 };
type Offer = { job: Job; target: Cell; priority: number; locks: string[]; preference: number };
type Bid = { unit: Unit; offer: Offer; route: Cell[]; cost: number };
function offer(job: Job, target: Cell, priority: number, locks: string[] = [], preference = 0): Offer {
  return { job, target, priority, locks, preference };
}
function availableOffers(game: Game, faction: Faction, navigation: Navigation, random: () => number): Offer[] {
  const offers: Offer[] = [];
  const enemies = game.units.filter((unit) => present(unit) && unit.faction !== faction);
  for (const enemy of enemies)
    offers.push(offer({ kind: "attack", targetId: enemy.id }, enemy.cell, faction === "colony" ? 200 : 100));
  if (faction === "colony") {
    if (enemies.length) {
      for (const cell of [ENTRANCE, ...(navigation.route(ENTRANCE, homeOf(game)) ?? [])]) {
        if (game.colony[cellKey(cell)] === "corridor" && !isFlooded(game, cellKey(cell)))
          offers.push(offer({ kind: "guard", destination: cell }, cell, 190));
      }
    }
    for (const [target, blueprint] of Object.entries(game.blueprints)) {
      const cell = point(target);
      const busy = game.units.filter(
        (unit) => unit.faction === faction && present(unit) && unit.job?.kind === "build" && unit.job.target === target,
      ).length;
      for (const stand of neighbors(cell)) {
        const tile = game.colony[cellKey(stand)];
        if (!connected(tile, blueprint.tile, stand.y === cell.y)) continue;
        for (let slot = busy; slot < MAX_BUILDERS; slot++)
          offers.push(offer({ kind: "build", target, stand }, stand, 100, [`build:${target}:${slot}`]));
      }
    }
    if (storageCapacity(game) > 0 && forageAllowed(game)) {
      const exit = { x: random() < 0.5 ? -1 : COLS, y: 0 };
      offers.push(offer({ kind: "forage", phase: "outbound", exit, remaining: 0 }, exit, 80));
    }
  } else if (!enemies.length) {
    offers.push(offer({ kind: "leave", destination: EXIT }, EXIT, 10));
  }
  const queenSeats = queenCells(game);
  const eggStorage = faction === "colony" ? eggStorageCells(game, navigation) : [];
  const foodStorage = faction === "colony" ? foodStorageCells(game).map((cell) => ({ cell, distance: 0 })) : [];
  for (const item of game.items) {
    if (item.location.kind !== "cell" || itemReserved(game, item.id)) continue;
    if (faction === "colony" && spawnClaimed(game, item.id)) continue;
    const source = item.location.cell;
    const tile = game.colony[cellKey(source)];
    if (
      faction === "colony" &&
      item.kind === "egg" &&
      tile === "nest" &&
      !queenSeats.some((cell) => sameCell(cell, source))
    )
      continue;
    if (faction === "colony" && item.kind === "food" && tile === "storage") continue;
    const destinations =
      faction === "raiders" ? [{ cell: EXIT, distance: 0 }] : item.kind === "food" ? foodStorage : eggStorage;
    for (const { cell, distance } of destinations) {
      if (!navigation.route(source, cell)) continue;
      const locks = [`item:${item.id}`];
      if (faction === "colony") locks.push(`cell:${cellKey(cell)}`);
      offers.push(
        offer(
          { kind: "haul", itemId: item.id, destination: cell, phase: "pickup" },
          source,
          faction === "raiders" ? 180 : item.kind === "food" ? 130 : 60,
          locks,
          distance,
        ),
      );
    }
  }
  return offers;
}
const surfaceEnemy = (game: Game, unit: Unit) =>
  game.units.some((other) => present(other) && other.faction !== unit.faction && other.cell.y === 0);
// A lasting threat keeps its surface unit on watch; once the effect is over it takes the exit.
const surfacePost = (game: Game, unit: Unit) => isSurface(unit) && !!game.narrator.effect && !surfaceEnemy(game, unit);
function surfaceOffer(game: Game, unit: Unit) {
  if (!isSurface(unit) || surfaceEnemy(game, unit)) return;
  return surfacePost(game, unit)
    ? offer({ kind: "guard", destination: SURFACE_POST }, SURFACE_POST, 10)
    : offer({ kind: "leave", destination: EXIT }, EXIT, 10);
}
function eligible(game: Game, unit: Unit, job: Job) {
  if (!traits[unit.role].jobs.includes(job.kind)) return false;
  if (job.kind === "attack" && unit.role === "worker" && unit.faction === "colony") return false;
  if (job.kind === "haul") {
    const item = game.items.find((item) => item.id === job.itemId);
    return !!item && canCarry(unit, item);
  }
  return true;
}
function fallback(game: Game, unit: Unit, navigation: Navigation, random: () => number): Offer | undefined {
  if (unit.job || unit.idleWait > 0 || unit.faction !== "colony") return;
  const surface = unit.role === "warrior" && random() < WARRIOR_SURFACE_CHANCE;
  const destinations = surface
    ? Array.from({ length: 7 }, (_, i) => ({ x: 5 + i, y: 0 }))
    : Object.keys(game.colony).map(point);
  const reachable = destinations.filter((cell) => !sameCell(cell, unit.cell) && navigation.from(unit, cell));
  const destination = reachable[Math.floor(random() * reachable.length)];
  return destination && offer({ kind: "wander", destination }, destination, 0);
}
export function assignTasks(
  game: Game,
  faction: Faction,
  navigation: Navigation,
  engaged: ReadonlySet<number>,
  random: () => number,
) {
  const free = game.units
    .filter(
      (unit) =>
        unit.faction === faction &&
        present(unit) &&
        !engaged.has(unit.id) &&
        unit.speed > 0 &&
        (!unit.job || unit.job.kind === "wander"),
    )
    .sort((a, b) => a.id - b.id);
  if (!free.length) return;
  const offers = availableOffers(game, faction, navigation, random);
  const bids: Bid[] = [];
  for (const unit of free) {
    const idle = fallback(game, unit, navigation, random);
    const post = surfaceOffer(game, unit);
    const own = isSurface(unit)
      ? offers.filter((candidate) => candidate.target.y === 0 && candidate.job.kind !== "leave")
      : offers;
    const extra = [...(idle ? [idle] : []), ...(post ? [post] : [])];
    for (const candidate of [...own, ...extra]) {
      if (!eligible(game, unit, candidate.job)) continue;
      const route = navigation.from(unit, candidate.target);
      if (!route) continue;
      const delivery =
        candidate.job.kind === "haul"
          ? (navigation.route(candidate.target, candidate.job.destination)?.length ?? 0)
          : 0;
      bids.push({ unit, offer: candidate, route, cost: (route.length - unit.travel + delivery) / unit.speed });
    }
  }
  bids.sort(
    (a, b) =>
      b.offer.priority - a.offer.priority ||
      b.offer.preference - a.offer.preference ||
      a.cost - b.cost ||
      a.unit.id - b.unit.id ||
      cellKey(a.offer.target).localeCompare(cellKey(b.offer.target)),
  );
  const assigned = new Set<number>();
  const locks = new Set<string>();
  for (const bid of bids) {
    if (assigned.has(bid.unit.id) || bid.offer.locks.some((lock) => locks.has(lock))) continue;
    const job = { ...bid.offer.job };
    bid.unit.job = job;
    bid.unit.idleWait = 0;
    setRoute(bid.unit, bid.route);
    assigned.add(bid.unit.id);
    for (const lock of bid.offer.locks) locks.add(lock);
  }
}
export function jobValid(game: Game, unit: Unit) {
  const job = unit.job;
  if (!job) return true;
  switch (job.kind) {
    case "build":
      return !!game.blueprints[job.target] && !!game.colony[cellKey(job.stand)] && !isFlooded(game, cellKey(job.stand));
    case "haul": {
      const item = game.items.find((item) => item.id === job.itemId);
      if (!item) return false;
      return job.phase === "pickup"
        ? item.location.kind === "cell"
        : item.location.kind === "carried" && item.location.unitId === unit.id;
    }
    case "attack":
      return game.units.some(
        (target) =>
          target.id === job.targetId &&
          present(target) &&
          target.faction !== unit.faction &&
          (!isSurface(unit) || target.cell.y === 0),
      );
    case "guard":
      if (isSurface(unit)) return surfacePost(game, unit);
      return game.units.some((target) => present(target) && target.faction !== unit.faction);
    case "forage":
    case "leave":
    case "flee":
      return true;
    case "wander":
      return (
        job.destination.y === 0 ||
        (!!game.colony[cellKey(job.destination)] && !isFlooded(game, cellKey(job.destination)))
      );
    case "nest":
      return game.colony[cellKey(job.destination)] === "nest" && !isFlooded(game, cellKey(job.destination));
  }
}
