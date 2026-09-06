import { COLS, cellKey } from "./cells";
import { isFlooded } from "./flood";
import type { Item } from "./items";
import type { Job } from "./jobs";
import type { Game } from "./model";
import { nestCapacity, nestFree, nestPopulation } from "./spawning";
import { foodStock, STORAGE_SLOTS, storageCapacity } from "./storage";
import { present, type Unit } from "./units";

export type LogSink = (line: string) => void;
export type LogSource = "ui" | "dev";
type Fields = Record<string, unknown>;
type TaskState = { root: Job; current: Job; phase: string | undefined; ended: boolean };
type LoggerState = {
  sink: LogSink;
  seq: number;
  nextCommandId: number;
  knownUnits: Set<number>;
  knownItems: Set<number>;
  deadUnits: Set<number>;
  tasks: Map<number, TaskState>;
};

export type SimulationLog = {
  snapshot: () => readonly string[];
};

const states = new WeakMap<Game, LoggerState>();
const safeToken = /^[A-Za-z0-9_.:,/+%-]+$/;

function numberValue(value: number) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function valueToken(value: unknown): string {
  if (typeof value === "number") return numberValue(value);
  if (typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (typeof value === "string") return safeToken.test(value) ? value : JSON.stringify(value);
  return JSON.stringify(value);
}

function fieldsText(fields: Fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${valueToken(value)}`)
    .join(" ");
}

function stateOf(game: Game) {
  return states.get(game);
}

function write(game: Game, category: string, fields: Fields) {
  const state = stateOf(game);
  if (!state) return undefined;
  state.seq++;
  const line = `seq=${state.seq} t=${numberValue(game.elapsedSeconds)} ${category} ${fieldsText(fields)}`;
  state.sink(line);
  return line;
}

function onMap(unit: Unit) {
  return present(unit) && !(unit.cell.y === 0 && (unit.cell.x === -1 || unit.cell.x === COLS));
}

function itemAmount(item: Item) {
  return item.kind === "food" ? item.portions : 1;
}

function locationFields(location: Item["location"]): Fields {
  return location.kind === "cell"
    ? { location: "cell", cell: cellKey(location.cell) }
    : { location: "carried", unit: location.unitId };
}

function copyJob(job: Job): Job {
  return { ...job } as Job;
}

function taskFields(job: Job): Fields {
  const fields: Fields = { job: job.kind };
  switch (job.kind) {
    case "build":
      fields.target = job.target;
      fields.stand = cellKey(job.stand);
      break;
    case "haul":
      fields.item = job.itemId;
      fields.destination = cellKey(job.destination);
      fields.phase = job.phase;
      break;
    case "forage":
      fields.destination = cellKey(job.exit);
      fields.phase = job.phase;
      break;
    case "attack":
      fields.target = job.targetId;
      break;
    default:
      fields.destination = cellKey(job.destination);
      break;
  }
  return fields;
}

function jobPhase(job: Job, phase?: string) {
  return phase ?? (job.kind === "haul" || job.kind === "forage" ? job.phase : undefined);
}

export function attachSimulationLog(game: Game, sink: LogSink): SimulationLog {
  const existing = stateOf(game);
  if (existing) {
    existing.sink = sink;
    return { snapshot: () => snapshotGame(game) };
  }
  const state: LoggerState = {
    sink,
    seq: 0,
    nextCommandId: 1,
    knownUnits: new Set(),
    knownItems: new Set(),
    deadUnits: new Set(),
    tasks: new Map(),
  };
  states.set(game, state);
  write(game, "game", { event: "started" });
  for (const unit of [...game.units].sort((a, b) => a.id - b.id)) {
    logUnitSpawned(game, unit);
    if (unit.hp <= 0) logUnitDied(game, unit);
  }
  for (const item of [...game.items].sort((a, b) => a.id - b.id)) logItemSpawned(game, item);
  return { snapshot: () => snapshotGame(game) };
}

export const connectSimulationLog = attachSimulationLog;

export function getSimulationLog(game: Game): SimulationLog | undefined {
  return stateOf(game) ? { snapshot: () => snapshotGame(game) } : undefined;
}

export function logUnitSpawned(game: Game, unit: Unit) {
  const state = stateOf(game);
  if (!state || state.knownUnits.has(unit.id)) return;
  state.knownUnits.add(unit.id);
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "spawned",
    cell: cellKey(unit.cell),
    on_map: onMap(unit),
  });
}

export function logUnitDied(game: Game, unit: Unit) {
  const state = stateOf(game);
  if (!state || state.deadUnits.has(unit.id)) return;
  state.deadUnits.add(unit.id);
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "died",
    cell: cellKey(unit.cell),
  });
}

export function logUnitFleeStarted(game: Game, unit: Unit) {
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "flee_started",
    cell: cellKey(unit.cell),
    hp: unit.hp,
  });
}

export function logUnitAttack(game: Game, unit: Unit, target: Unit, damage: number) {
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "attack",
    target: target.id,
    damage,
  });
}

export function logArrived(game: Game, unit: Unit) {
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "arrived",
    cell: cellKey(unit.cell),
  });
}

export function logForageLeft(game: Game, unit: Unit, exit: { x: number; y: number }) {
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "forage_left",
    exit: cellKey(exit),
  });
}

export function logForageReturned(game: Game, unit: Unit, item: Item) {
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    event: "forage_returned",
    item: item.id,
    amount: itemAmount(item),
  });
}

export function logTaskStarted(game: Game, unit: Unit, job: Job) {
  const state = stateOf(game);
  if (!state) return;
  const previous = state.tasks.get(unit.id);
  if (previous && !previous.ended) {
    write(game, "unit", {
      id: unit.id,
      role: unit.role,
      faction: unit.faction,
      ...taskFields(previous.current),
      event: "task_ended",
      result: "cancelled",
      reason: "reassigned",
    });
  }
  state.tasks.set(unit.id, { root: copyJob(job), current: copyJob(job), phase: jobPhase(job), ended: false });
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    ...taskFields(job),
    event: "task_started",
  });
}

export function logTaskPhase(game: Game, unit: Unit, job: Job, phase: string) {
  const state = stateOf(game);
  if (!state) return;
  const current = state.tasks.get(unit.id);
  const previousPhase = current?.phase;
  if (current?.ended || previousPhase === `${job.kind}:${phase}`) return;
  if (current) {
    current.current = copyJob(job);
    current.phase = `${job.kind}:${phase}`;
  } else
    state.tasks.set(unit.id, {
      root: copyJob(job),
      current: copyJob(job),
      phase: `${job.kind}:${phase}`,
      ended: false,
    });
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    ...taskFields(job),
    phase,
    event: "task_phase",
  });
}

export function logTaskEnded(game: Game, unit: Unit, job: Job, result: "completed" | "cancelled", reason?: string) {
  const state = stateOf(game);
  if (!state) return;
  const current = state.tasks.get(unit.id);
  if (current?.ended) return;
  if (current) {
    current.current = copyJob(job);
    current.ended = true;
  } else state.tasks.set(unit.id, { root: copyJob(job), current: copyJob(job), phase: jobPhase(job), ended: true });
  write(game, "unit", {
    id: unit.id,
    role: unit.role,
    faction: unit.faction,
    ...taskFields(job),
    event: "task_ended",
    result,
    reason,
  });
}

export function logItemSpawned(game: Game, item: Item) {
  const state = stateOf(game);
  if (!state || state.knownItems.has(item.id)) return;
  state.knownItems.add(item.id);
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    amount: itemAmount(item),
    event: "spawned",
    ...locationFields(item.location),
  });
}

export function logItemPickedUp(game: Game, item: Item, unit: Unit) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    unit: unit.id,
    amount: itemAmount(item),
    event: "picked_up",
  });
}

export function logItemDelivered(
  game: Game,
  item: Item,
  unit: Unit,
  amount: number,
  destination: { x: number; y: number },
) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    unit: unit.id,
    amount,
    destination: cellKey(destination),
    event: "delivered",
  });
}

export function logItemDropped(game: Game, item: Item, unit: Unit, reason: string) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    unit: unit.id,
    amount: itemAmount(item),
    cell: item.location.kind === "cell" ? cellKey(item.location.cell) : cellKey(unit.cell),
    reason,
    event: "dropped",
  });
}

export function logItemLost(game: Game, item: Item, reason: string, unit?: Unit, amount = itemAmount(item)) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    amount,
    unit: unit?.id,
    reason,
    event: "lost",
  });
}

export function logItemDestroyed(game: Game, item: Item, reason: string, cell?: string) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    amount: itemAmount(item),
    cell,
    reason,
    event: "destroyed",
  });
}

export function logItemConsumed(game: Game, item: Item, amount: number, reason: string) {
  write(game, "item", {
    id: item.id,
    kind: item.kind,
    food: item.kind === "food" ? item.food : undefined,
    amount,
    reason,
    event: "consumed",
  });
}

export function runLoggedCommand(
  game: Game,
  source: LogSource,
  name: string,
  params: Fields,
  run: () => string | null,
) {
  const state = stateOf(game);
  const commandId = state ? state.nextCommandId++ : undefined;
  if (commandId !== undefined)
    write(game, "command", { source, name, command_id: commandId, event: "requested", params });
  try {
    const reason = run();
    if (commandId !== undefined)
      write(game, "command", {
        source,
        name,
        command_id: commandId,
        event: "result",
        result: reason ? "rejected" : "success",
        ok: !reason,
        reason: reason ?? undefined,
      });
    return reason;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (commandId !== undefined)
      write(game, "command", {
        source,
        name,
        command_id: commandId,
        event: "result",
        result: "rejected",
        ok: false,
        reason,
      });
    throw error;
  }
}

export function logIncidentWarning(game: Game, kind: string, seconds: number) {
  write(game, "incident", { kind, seconds, event: "warned" });
}

export function logIncidentStarted(game: Game, kind: string, size: number) {
  write(game, "incident", { kind, size, event: "started" });
}

export function logIncidentEnded(game: Game, kind: string) {
  write(game, "incident", { kind, event: "ended" });
}

export function logConstructionOrdered(game: Game, cell: string, tile: string) {
  write(game, "construction", { cell, tile, event: "build_ordered" });
}

export function logConstructionCompleted(game: Game, cell: string, tile: string) {
  write(game, "construction", { cell, tile, event: "build_completed" });
}

export function logConstructionCancelled(game: Game, cell: string, tile: string, reason: string) {
  write(game, "construction", { cell, tile, event: "build_cancelled", reason });
}

export function logConstructionDemolished(game: Game, cell: string, tile: string | undefined) {
  write(game, "construction", { cell, tile, event: "demolished" });
}

export function logSpawnOrdered(game: Game, egg: number, role: string) {
  write(game, "spawn", { egg, role, event: "spawn_ordered" });
}

export function logSpawnCompleted(game: Game, egg: number, role: string) {
  write(game, "spawn", { egg, role, event: "spawn_completed" });
}

export function logSpawnCancelled(game: Game, egg: number, role: string, reason: string) {
  write(game, "spawn", { egg, role, event: "spawn_cancelled", reason });
}

function snapshotGame(game: Game) {
  const lines: string[] = [];
  const record = (fields: Fields) => {
    const line = write(game, "snapshot", fields);
    if (line) lines.push(line);
  };
  record({ event: "started" });
  const activeStorageCells = Object.entries(game.colony).filter(
    ([id, tile]) => tile === "storage" && !isFlooded(game, id),
  ).length;
  record({
    event: "resources",
    elapsed: game.elapsedSeconds,
    food: foodStock(game),
    food_capacity: activeStorageCells * STORAGE_SLOTS,
    food_free: storageCapacity(game),
    nest_capacity: nestCapacity(game),
    nest_population: nestPopulation(game),
    nest_free: nestFree(game),
    deliveries: game.deliveries,
  });
  for (const [cell, tile] of Object.entries(game.colony).sort(([a], [b]) => a.localeCompare(b)))
    record({ event: "cell", cell, tile });
  for (const [cell, blueprint] of Object.entries(game.blueprints).sort(([a], [b]) => a.localeCompare(b)))
    record({
      event: "blueprint",
      cell,
      tile: blueprint.tile,
      progress: blueprint.progress,
      workers: blueprint.workers,
    });
  for (const unit of [...game.units].sort((a, b) => a.id - b.id)) {
    const job = unit.job ? taskFields(unit.job) : {};
    const cargo = game.items.find((item) => item.location.kind === "carried" && item.location.unitId === unit.id);
    record({
      event: "unit",
      id: unit.id,
      role: unit.role,
      faction: unit.faction,
      cell: cellKey(unit.cell),
      on_map: onMap(unit),
      present: present(unit),
      hp: unit.hp,
      max_hp: unit.maxHp,
      fleeing: unit.fleeing,
      cargo: cargo?.id,
      ...job,
    });
  }
  for (const item of [...game.items].sort((a, b) => a.id - b.id))
    record({
      event: "item",
      id: item.id,
      kind: item.kind,
      food: item.kind === "food" ? item.food : undefined,
      amount: itemAmount(item),
      ...locationFields(item.location),
    });
  for (const spawn of [...game.spawns].sort((a, b) => a.eggId - b.eggId))
    record({ event: "spawn", egg: spawn.eggId, role: spawn.role, progress: spawn.progress });
  const narrator = game.narrator;
  record({
    event: "incidents",
    phase: narrator.phase,
    difficulty: narrator.difficulty,
    active: narrator.active ?? "none",
    pending: narrator.pending?.incident ?? "none",
    pending_size: narrator.pending?.size,
    pending_at: narrator.pending?.at,
    boon: narrator.boon?.kind ?? "none",
    boon_until: narrator.boon?.until,
    effect: narrator.effect?.kind ?? "none",
    effect_until: narrator.effect?.until,
    next_incident_at: narrator.nextIncidentAt,
    last_peak_at: narrator.lastPeakAt,
  });
  record({ event: "flood", cells: [...game.flood].sort() });
  record({ event: "finished" });
  return lines;
}

export function snapshot(game: Game) {
  return snapshotGame(game);
}
