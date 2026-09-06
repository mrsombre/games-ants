import { type Cell, COLS, cellKey, ENTRANCE, HOME, neighbors, point, sameCell } from "./cells";
import { connected } from "./colony";
import { nurseryCells, storageCells } from "./eggs";
import { canCarry, itemReserved } from "./items";
import type { Job } from "./jobs";
import type { Game } from "./model";
import { type Navigation, setRoute } from "./navigation";
import { type Faction, present, traits, type Unit } from "./units";

export const WANDER_MIN_SECONDS = 5;
export const WANDER_MAX_SECONDS = 30;
export const WARRIOR_SURFACE_CHANCE = 0.75;
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
      for (const cell of [ENTRANCE, ...(navigation.route(ENTRANCE, HOME) ?? [])]) {
        if (game.colony[cellKey(cell)] === "corridor")
          offers.push(offer({ kind: "guard", destination: cell }, cell, 190));
      }
    }
    for (const [target, blueprint] of Object.entries(game.blueprints)) {
      const cell = point(target);
      for (const stand of neighbors(cell)) {
        const tile = game.colony[cellKey(stand)];
        if (blueprint.tile === "corridor" ? tile === "corridor" : connected(tile, "room", stand.y === cell.y)) {
          offers.push(offer({ kind: "build", target, stand }, stand, 100));
        }
      }
    }
    const exit = { x: random() < 0.5 ? -1 : COLS, y: 0 };
    offers.push(offer({ kind: "forage", phase: "outbound", exit, remaining: 0 }, exit, 80));
  } else if (!enemies.length) {
    offers.push(offer({ kind: "leave", destination: { x: -1, y: 0 } }, { x: -1, y: 0 }, 10));
  }
  const nursery = nurseryCells(game);
  const storage = faction === "colony" ? storageCells(game, navigation) : [];
  for (const item of game.items) {
    if (item.location.kind !== "cell" || itemReserved(game, item.id)) continue;
    if (faction === "colony" && game.spawns.some((spawn) => spawn.eggId === item.id)) continue;
    const source = item.location.cell;
    if (
      faction === "colony" &&
      item.kind === "egg" &&
      game.colony[cellKey(source)] === "room" &&
      !nursery.some((cell) => sameCell(cell, source))
    )
      continue;
    const destinations =
      faction === "raiders"
        ? [{ cell: { x: -1, y: 0 }, distance: 0 }]
        : item.kind === "food"
          ? [{ cell: HOME, distance: 0 }]
          : storage;
    for (const { cell, distance } of destinations) {
      if (!navigation.route(source, cell)) continue;
      const locks = [`item:${item.id}`];
      if (faction === "colony" && item.kind === "egg") locks.push(`cell:${cellKey(cell)}`);
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
    for (const candidate of idle ? [...offers, idle] : offers) {
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
      return !!game.blueprints[job.target] && !!game.colony[cellKey(job.stand)];
    case "haul": {
      const item = game.items.find((item) => item.id === job.itemId);
      if (!item) return false;
      return job.phase === "pickup"
        ? item.location.kind === "cell"
        : item.location.kind === "carried" && item.location.unitId === unit.id;
    }
    case "attack":
      return game.units.some(
        (target) => target.id === job.targetId && present(target) && target.faction !== unit.faction,
      );
    case "guard":
      return game.units.some((target) => present(target) && target.faction !== unit.faction);
    case "forage":
    case "leave":
      return true;
    case "wander":
      return job.destination.y === 0 || !!game.colony[cellKey(job.destination)];
  }
}
