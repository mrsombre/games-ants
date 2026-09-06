import { colonyDepth } from "./colony";
import { recedeFlood, startFlood } from "./flood";
import { type FoodKind, forageWeight } from "./items";
import { type Game, type GameEvent, queenOf } from "./model";
import { spawnWave } from "./raids";
import { spawnableEggs } from "./spawning";
import { foodStock } from "./storage";
import { type RaidRole, type SpawnRole, spawnCost } from "./units";

export type IncidentKind = "raid" | "thieves" | "boss" | "flood" | "rich-forage" | "food-nearby";
export type IncidentClass = "threat" | "boon";
export type TensionPhase = "buildup" | "peak" | "recovery";
export type Narrator = {
  rng: number;
  difficulty: number;
  phase: TensionPhase;
  phaseLeft: number;
  nextIncidentAt: number;
  pending: { incident: IncidentKind; size: number; at: number } | null;
  active: IncidentKind | null;
  census: number;
  lastPeakAt: number;
  lastLoss: number;
  boon: { kind: IncidentKind; until: number } | null;
  effect: { kind: IncidentKind; until: number } | null;
};

export const DAY_SECONDS = 600;
// One consumption is the food a warrior costs, the most expensive hatch order.
export const FOOD_CONSUMPTION = 3;
export const narratorConfig = {
  difficulty: 1,
  peakIntervalSeconds: DAY_SECONDS,
  buildupSeconds: 360,
  recoverySeconds: 240,
  minorMinSeconds: 60,
  minorMaxSeconds: 150,
  warnMinSeconds: 30,
  warnMaxSeconds: 45,
  boonSeconds: 150,
  weakConsumptions: 2,
  weakLoss: 0.34,
  mercyThreat: 0.4,
  mercyBoon: 2,
  bossWeight: 0.4,
  bossArmedWeight: 1.1,
  bossWarriors: 2,
  floodWeight: 0.5,
  floodDeepWeight: 0.5,
  floodDepthRows: 5,
};

export function nextRandom(narrator: Narrator) {
  narrator.rng = (Math.imul(narrator.rng, 1664525) + 1013904223) >>> 0;
  return narrator.rng / 4294967296;
}
const between = (narrator: Narrator, min: number, max: number) => min + nextRandom(narrator) * (max - min);
const pace = (narrator: Narrator, seconds: number) => seconds / narrator.difficulty;

export function createNarrator(seed: number, difficulty = narratorConfig.difficulty): Narrator {
  const narrator: Narrator = {
    rng: seed >>> 0,
    difficulty,
    phase: "buildup",
    phaseLeft: 0,
    nextIncidentAt: 0,
    pending: null,
    active: null,
    census: 0,
    lastPeakAt: 0,
    lastLoss: 0,
    boon: null,
    effect: null,
  };
  if (difficulty <= 0) return narrator;
  narrator.phaseLeft = pace(narrator, narratorConfig.buildupSeconds);
  narrator.nextIncidentAt = pace(
    narrator,
    between(narrator, narratorConfig.minorMinSeconds, narratorConfig.minorMaxSeconds),
  );
  return narrator;
}

export const colonyAnts = (game: Game) =>
  game.units.filter((unit) => unit.faction === "colony" && unit.role !== "queen" && unit.hp > 0);
export const strength = (game: Game) =>
  colonyAnts(game).reduce((sum, unit) => sum + spawnCost[unit.role as SpawnRole], 0) + foodStock(game);

export type Signals = {
  consumptions: number;
  warriors: number;
  queenHurt: boolean;
  freeEggs: number;
  depth: number;
  lastLoss: number;
  weak: boolean;
};
export function signals(game: Game): Signals {
  const ants = colonyAnts(game);
  const warriors = ants.filter((unit) => unit.role === "warrior").length;
  const queen = queenOf(game);
  const queenHurt = !!queen && queen.hp < queen.maxHp;
  const consumptions = foodStock(game) / FOOD_CONSUMPTION;
  const lastLoss = game.narrator.lastLoss;
  const weak =
    consumptions < narratorConfig.weakConsumptions || warriors === 0 || queenHurt || lastLoss > narratorConfig.weakLoss;
  return {
    consumptions,
    warriors,
    queenHurt,
    freeEggs: spawnableEggs(game).length,
    depth: colonyDepth(game.colony),
    lastLoss,
    weak,
  };
}

export const raidRoles = (size: number): SpawnRole[] =>
  Array.from({ length: size }, (_, index) => (index % 2 === 0 ? "worker" : "warrior"));
export const thievesRoles = (size: number): SpawnRole[] =>
  Array.from({ length: size }, (_, index) => (index % 2 === 0 ? "worker" : "scout"));
export const bossRoles = (size: number): RaidRole[] => [
  "beetle",
  ...Array.from({ length: Math.max(0, size - 1) }, () => "warrior" as const),
];
export const waveSize = (game: Game, share: number, cap: number) =>
  Math.max(1, Math.min(cap, Math.ceil(strength(game) * share * game.narrator.difficulty)));
function startBoon(game: Game, kind: IncidentKind) {
  game.narrator.boon = { kind, until: game.elapsedSeconds + narratorConfig.boonSeconds };
}

type Incident = {
  kind: IncidentKind;
  class: IncidentClass;
  weight: (signals: Signals) => number;
  size: (game: Game) => number;
  // Returns the size the incident actually reached: a wave brings exactly the asked-for
  // raiders, a flood may find fewer cells than requested.
  start: (game: Game, size: number) => number;
  end?: (game: Game) => void;
};
export const incidents: Incident[] = [
  {
    kind: "raid",
    class: "threat",
    weight: () => 1,
    size: (game) => waveSize(game, 0.12, 10),
    start: (game, size) => spawnWave(game, raidRoles(size), nextRandom(game.narrator)).length,
  },
  {
    kind: "thieves",
    class: "threat",
    weight: (signals) => 0.5 + 0.25 * signals.freeEggs,
    size: (game) => waveSize(game, 0.08, 6),
    start: (game, size) => spawnWave(game, thievesRoles(size), nextRandom(game.narrator)).length,
  },
  {
    kind: "boss",
    class: "threat",
    weight: (signals) =>
      narratorConfig.bossWeight +
      (signals.warriors >= narratorConfig.bossWarriors ? narratorConfig.bossArmedWeight : 0),
    size: (game) => waveSize(game, 0.04, 3),
    start: (game, size) => spawnWave(game, bossRoles(size), nextRandom(game.narrator)).length,
  },
  {
    kind: "flood",
    class: "threat",
    weight: (signals) =>
      narratorConfig.floodWeight +
      (signals.depth >= narratorConfig.floodDepthRows ? narratorConfig.floodDeepWeight : 0),
    size: (game) => waveSize(game, 0.03, 3),
    start: (game, size) => startFlood(game, size, nextRandom(game.narrator)),
    end: (game) => recedeFlood(game),
  },
  {
    kind: "rich-forage",
    class: "boon",
    weight: (signals) => 0.5 + 2 * signals.lastLoss,
    size: () => 1,
    start: (game, size) => {
      startBoon(game, "rich-forage");
      return size;
    },
  },
  {
    kind: "food-nearby",
    class: "boon",
    weight: (signals) => 0.5 + (signals.consumptions < narratorConfig.weakConsumptions ? 1.5 : 0),
    size: () => 1,
    start: (game, size) => {
      startBoon(game, "food-nearby");
      return size;
    },
  },
];

export function incidentWeight(incident: Incident, state: Signals) {
  const base = incident.weight(state);
  if (!state.weak) return base;
  return incident.class === "threat" ? base * narratorConfig.mercyThreat : base * narratorConfig.mercyBoon;
}
export function pickIncident(game: Game, allowed: readonly IncidentClass[]) {
  const state = signals(game);
  const pool = incidents.filter(
    (incident) => allowed.includes(incident.class) && !(incident.class === "boon" && game.narrator.boon),
  );
  const weights = pool.map((incident) => incidentWeight(incident, state));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = nextRandom(game.narrator) * total;
  for (const [index, incident] of pool.entries()) {
    const weight = weights[index] ?? 0;
    if (roll < weight) return incident;
    roll -= weight;
  }
  return undefined;
}

export const incidentOf = (kind: IncidentKind) => incidents.find((entry) => entry.kind === kind) as Incident;
function startIncident(game: Game, kind: IncidentKind, size: number, events: GameEvent[]) {
  const narrator = game.narrator;
  const incident = incidentOf(kind);
  const started = incident.start(game, size);
  if (incident.class === "threat") {
    narrator.active = kind;
    narrator.census = colonyAnts(game).length;
    if (narrator.phase === "peak") {
      narrator.phase = "recovery";
      narrator.phaseLeft = pace(narrator, narratorConfig.recoverySeconds);
      narrator.lastPeakAt = game.elapsedSeconds;
    }
  }
  events.push({ kind: "incident-started", incident: kind, size: started });
}
const allowedClasses: Record<TensionPhase, readonly IncidentClass[]> = {
  buildup: ["threat", "boon"],
  peak: ["threat"],
  recovery: ["boon"],
};
export function advanceNarrator(game: Game, seconds: number, events: GameEvent[]) {
  const narrator = game.narrator;
  if (narrator.difficulty <= 0) return;
  narrator.phaseLeft = Math.max(0, narrator.phaseLeft - seconds);
  if (narrator.pending) {
    if (game.elapsedSeconds < narrator.pending.at) return;
    const { incident, size } = narrator.pending;
    narrator.pending = null;
    startIncident(game, incident, size, events);
    return;
  }
  if (game.elapsedSeconds < narrator.nextIncidentAt) return;
  const peakDue = game.elapsedSeconds - narrator.lastPeakAt >= narratorConfig.peakIntervalSeconds;
  if (narrator.phase === "recovery" && narrator.phaseLeft <= 0) {
    narrator.phase = "buildup";
    narrator.phaseLeft = pace(narrator, narratorConfig.buildupSeconds);
  } else if (narrator.phase === "buildup" && narrator.phaseLeft <= 0 && peakDue) {
    narrator.phase = "peak";
  }
  narrator.nextIncidentAt =
    game.elapsedSeconds +
    pace(narrator, between(narrator, narratorConfig.minorMinSeconds, narratorConfig.minorMaxSeconds));
  if (narrator.active) return;
  const incident = pickIncident(game, allowedClasses[narrator.phase]);
  if (!incident) return;
  const size = incident.size(game);
  if (incident.class === "boon") return startIncident(game, incident.kind, size, events);
  const delay = between(narrator, narratorConfig.warnMinSeconds, narratorConfig.warnMaxSeconds);
  narrator.pending = { incident: incident.kind, size, at: game.elapsedSeconds + delay };
  events.push({ kind: "incident-warned", incident: incident.kind, seconds: delay });
}
export function settleIncidents(game: Game, events: GameEvent[]) {
  const narrator = game.narrator;
  if (narrator.boon && game.elapsedSeconds >= narrator.boon.until) {
    events.push({ kind: "incident-ended", incident: narrator.boon.kind });
    narrator.boon = null;
  }
  const effect = narrator.effect;
  if (effect && game.elapsedSeconds >= effect.until) {
    incidentOf(effect.kind).end?.(game);
    narrator.effect = null;
  }
  if (narrator.active && !narrator.effect && !game.units.some((unit) => unit.faction === "raiders")) {
    const survivors = colonyAnts(game).length;
    narrator.lastLoss = narrator.census > 0 ? Math.max(0, (narrator.census - survivors) / narrator.census) : 0;
    events.push({ kind: "incident-ended", incident: narrator.active });
    narrator.active = null;
  }
}

export const FORAGE_MIN_SECONDS = 5;
export const FORAGE_MAX_SECONDS = 60;
export const NEARBY_MIN_SECONDS = 2;
export const NEARBY_MAX_SECONDS = 10;
export const richForageWeight: Record<FoodKind, number> = { apple: 0.3, mushroom: 0.3, caterpillar: 0.4 };
export const forageWeights = (game: Game) =>
  game.narrator.boon?.kind === "rich-forage" ? richForageWeight : forageWeight;
export const forageSeconds = (game: Game, roll: number) =>
  game.narrator.boon?.kind === "food-nearby"
    ? NEARBY_MIN_SECONDS + roll * (NEARBY_MAX_SECONDS - NEARBY_MIN_SECONDS)
    : FORAGE_MIN_SECONDS + roll * (FORAGE_MAX_SECONDS - FORAGE_MIN_SECONDS);
