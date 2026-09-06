import { expect, it } from "vitest";
import { forageWeight } from "./items";
import type { GameEvent } from "./model";
import {
  advanceNarrator,
  bossRoles,
  colonyAnts,
  createNarrator,
  FORAGE_MAX_SECONDS,
  FORAGE_MIN_SECONDS,
  forageSeconds,
  forageWeights,
  incidentOf,
  incidents,
  incidentWeight,
  NEARBY_MAX_SECONDS,
  NEARBY_MIN_SECONDS,
  narratorConfig,
  nextRandom,
  pickIncident,
  raidRoles,
  richForageWeight,
  settleIncidents,
  signals,
  strength,
  thievesRoles,
} from "./narrator";
import { createGame } from "./simulation";
import { addUnit, advance, food, world } from "./test-support";

function narrated(difficulty = 1) {
  const game = world();
  game.narrator = createNarrator(11, difficulty);
  return game;
}
function run(game: ReturnType<typeof narrated>, seconds: number, repel = false) {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / 0.05); i++) {
    game.elapsedSeconds += 0.05;
    advanceNarrator(game, 0.05, events);
    if (repel) game.units = game.units.filter((unit) => unit.faction === "colony");
    settleIncidents(game, events);
  }
  return events;
}

it("produces the same stream for the same seed and a different one for another seed", () => {
  const first = createNarrator(42);
  const second = createNarrator(42);
  const other = createNarrator(43);
  const draw = (narrator: typeof first) => Array.from({ length: 5 }, () => nextRandom(narrator));
  const sequence = draw(first);
  expect(sequence).toEqual(draw(second));
  expect(sequence).not.toEqual(draw(other));
  expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  expect(first.rng).toBe(second.rng);
});
it("starts in buildup with a scheduled first incident and scales pacing by difficulty", () => {
  const easy = createNarrator(5, 1);
  const hard = createNarrator(5, 2);
  expect(easy.phase).toBe("buildup");
  expect(easy.phaseLeft).toBe(narratorConfig.buildupSeconds);
  expect(hard.phaseLeft).toBe(narratorConfig.buildupSeconds / 2);
  expect(easy.nextIncidentAt).toBeGreaterThanOrEqual(narratorConfig.minorMinSeconds);
  expect(easy.nextIncidentAt).toBeLessThanOrEqual(narratorConfig.minorMaxSeconds);
  expect(hard.nextIncidentAt).toBeCloseTo(easy.nextIncidentAt / 2, 8);
  expect([easy.pending, easy.boon, easy.active]).toEqual([null, null, null]);
  expect([easy.lastPeakAt, easy.lastLoss, easy.census]).toEqual([0, 0, 0]);
});
it("stays silent at difficulty zero and leaves its state untouched", () => {
  const game = narrated(0);
  const before = structuredClone(game.narrator);
  expect(run(game, 1800)).toEqual([]);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual([]);
  expect(game.narrator).toEqual(before);
  expect(before.phaseLeft).toBe(0);
});
it("sums living colony ants by hatch cost plus stored food and ignores the queen and raiders", () => {
  const game = world();
  expect(strength(game)).toBe(0);
  addUnit(game, "worker");
  addUnit(game, "scout");
  addUnit(game, "warrior");
  const dead = addUnit(game, "worker");
  dead.hp = 0;
  addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  food(game, { x: 7, y: 2 }, "caterpillar");
  expect(colonyAnts(game)).toHaveLength(3);
  expect(strength(game)).toBe(1 + 2 + 3 + 2);
});
it.each([
  ["food", (game: ReturnType<typeof world>) => game.items.splice(0)],
  ["warriors", (game: ReturnType<typeof world>) => game.units.splice(1)],
  [
    "queen",
    (game: ReturnType<typeof world>) => {
      const queen = game.units[0];
      if (queen) queen.hp = 1;
    },
  ],
  ["losses", (game: ReturnType<typeof world>) => (game.narrator.lastLoss = 0.5)],
])("treats a colony short on %s as weak and a stocked one as strong", (_label, weaken) => {
  const game = world();
  addUnit(game, "warrior");
  for (const cell of [
    { x: 7, y: 2 },
    { x: 7, y: 2 },
    { x: 6, y: 2 },
  ])
    food(game, cell, "caterpillar");
  const strong = signals(game);
  expect(strong.weak).toBe(false);
  expect(strong.warriors).toBe(1);
  expect(strong.queenHurt).toBe(false);
  expect(strong.consumptions).toBeCloseTo(2, 8);
  weaken(game);
  expect(signals(game).weak).toBe(true);
});
it("keeps the catalog v1 kinds, classes and sizes", () => {
  const game = narrated();
  expect(incidents.map((incident) => [incident.kind, incident.class])).toEqual([
    ["raid", "threat"],
    ["thieves", "threat"],
    ["boss", "threat"],
    ["rich-forage", "boon"],
    ["food-nearby", "boon"],
  ]);
  for (const incident of incidents) {
    expect(incidentOf(incident.kind)).toBe(incident);
    expect(incident.size(game)).toBe(1);
  }
  for (const kind of ["rich-forage", "food-nearby"] as const) {
    incidentOf(kind).start(game, 1);
    expect(game.narrator.boon).toEqual({ kind, until: game.elapsedSeconds + narratorConfig.boonSeconds });
    expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual([]);
    game.narrator.boon = null;
  }
  incidentOf("raid").start(game, 2);
  incidentOf("thieves").start(game, 2);
  incidentOf("boss").start(game, 2);
  expect(game.units.filter((unit) => unit.faction === "raiders").map((unit) => unit.role)).toEqual([
    "worker",
    "warrior",
    "worker",
    "scout",
    "beetle",
    "warrior",
  ]);
});
it("raises the food-nearby weight only while food is short", () => {
  const hungry = { consumptions: 1.99, warriors: 1, queenHurt: false, freeEggs: 0, lastLoss: 0, weak: false };
  const fed = { ...hungry, consumptions: narratorConfig.weakConsumptions };
  const nearby = incidentOf("food-nearby");
  expect(nearby.weight(hungry)).toBeCloseTo(2, 8);
  expect(nearby.weight(fed)).toBeCloseTo(0.5, 8);
  expect(incidentOf("rich-forage").weight({ ...fed, lastLoss: 0.25 })).toBeCloseTo(1, 8);
});
it("counts warriors apart from the rest of the colony and spares a colony at the loss threshold", () => {
  const game = world();
  addUnit(game, "worker");
  addUnit(game, "scout");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  expect(signals(game).warriors).toBe(2);
  game.narrator.lastLoss = narratorConfig.weakLoss;
  for (const cell of [
    { x: 7, y: 2 },
    { x: 7, y: 2 },
    { x: 6, y: 2 },
  ])
    food(game, cell, "caterpillar");
  expect(signals(game).weak).toBe(false);
  game.narrator.lastLoss = narratorConfig.weakLoss + 0.01;
  expect(signals(game).weak).toBe(true);
});
it("counts free eggs as a thieves signal", () => {
  const game = world();
  expect(signals(game).freeEggs).toBe(0);
  game.items.push({ id: 90, kind: "egg", location: { kind: "cell", cell: { x: 6, y: 4 } } });
  expect(signals(game).freeEggs).toBe(1);
  expect(incidents.find((incident) => incident.kind === "thieves")?.weight(signals(game))).toBeCloseTo(0.75, 8);
});
it("softens large threats and doubles boons for a weak colony without zeroing any weight", () => {
  const weak = { consumptions: 0, warriors: 0, queenHurt: true, freeEggs: 0, lastLoss: 0.5, weak: true };
  const strong = { ...weak, weak: false };
  for (const incident of incidents) {
    const base = incident.weight(strong);
    const merciful = incidentWeight(incident, weak);
    expect(base).toBeGreaterThan(0);
    expect(incidentWeight(incident, strong)).toBe(base);
    expect(merciful).toBeGreaterThan(0);
    expect(merciful).toBeCloseTo(
      base * (incident.class === "threat" ? narratorConfig.mercyThreat : narratorConfig.mercyBoon),
      8,
    );
  }
  expect(narratorConfig.mercyThreat).toBeGreaterThanOrEqual(0.3);
  expect(narratorConfig.mercyThreat).toBeLessThanOrEqual(0.5);
});
it("picks only allowed classes, skips boons while one runs and reports nothing when the pool is empty", () => {
  const game = narrated();
  for (let i = 0; i < 20; i++) expect(pickIncident(game, ["threat"])?.class).toBe("threat");
  for (let i = 0; i < 20; i++) expect(pickIncident(game, ["boon"])?.class).toBe("boon");
  const classes = new Set(Array.from({ length: 40 }, () => pickIncident(game, ["threat", "boon"])?.kind));
  expect(classes.size).toBeGreaterThan(1);
  game.narrator.boon = { kind: "rich-forage", until: 100 };
  expect(pickIncident(game, ["boon"])).toBeUndefined();
  expect(pickIncident(game, ["threat"])?.class).toBe("threat");
  expect(pickIncident(game, [])).toBeUndefined();
});
it("keeps every drawn interval inside its configured window", () => {
  const warnings: number[] = [];
  const gaps: number[] = [];
  for (let seed = 0; seed < 40; seed++) {
    const game = world();
    game.narrator = createNarrator(seed);
    gaps.push(game.narrator.nextIncidentAt);
    game.narrator.phase = "peak";
    game.narrator.nextIncidentAt = 0;
    const events: GameEvent[] = [];
    game.elapsedSeconds += 0.05;
    advanceNarrator(game, 0.05, events);
    const warned = events[0];
    if (warned?.kind !== "incident-warned") throw new Error("no warning");
    warnings.push(warned.seconds);
    gaps.push(game.narrator.nextIncidentAt - game.elapsedSeconds);
  }
  expect(Math.min(...warnings)).toBeGreaterThanOrEqual(narratorConfig.warnMinSeconds);
  expect(Math.max(...warnings)).toBeLessThanOrEqual(narratorConfig.warnMaxSeconds);
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(narratorConfig.minorMinSeconds);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(narratorConfig.minorMaxSeconds);
});
it("acts exactly at the scheduled instant, not a tick later", () => {
  const game = narrated();
  game.narrator.nextIncidentAt = 5;
  game.narrator.phase = "peak";
  game.elapsedSeconds = 5;
  const events: GameEvent[] = [];
  advanceNarrator(game, 0.05, events);
  expect(events.map((event) => event.kind)).toEqual(["incident-warned"]);
  const pending = game.narrator.pending;
  if (!pending) throw new Error("no pending threat");
  game.elapsedSeconds = pending.at;
  advanceNarrator(game, 0.05, events);
  expect(game.narrator.pending).toBeNull();
  expect(events.at(-1)).toMatchObject({ kind: "incident-started" });
  game.narrator.boon = { kind: "food-nearby", until: 300 };
  game.elapsedSeconds = 300;
  const closing: GameEvent[] = [];
  settleIncidents(game, closing);
  expect(closing).toEqual([{ kind: "incident-ended", incident: "food-nearby" }]);
});
it("waits a full peak interval before the next peak", () => {
  const game = narrated();
  game.narrator.phaseLeft = 0;
  game.narrator.nextIncidentAt = 0;
  game.narrator.lastPeakAt = 100;
  game.elapsedSeconds = 100 + narratorConfig.peakIntervalSeconds - 1;
  advanceNarrator(game, 0.05, []);
  expect(game.narrator.phase).toBe("buildup");
  game.narrator.nextIncidentAt = 0;
  game.elapsedSeconds = 100 + narratorConfig.peakIntervalSeconds;
  advanceNarrator(game, 0.05, []);
  expect(game.narrator.phase).toBe("peak");
});
it("warns thirty to forty-five seconds before every threat and starts it exactly then", () => {
  const game = narrated();
  game.narrator.nextIncidentAt = 0;
  game.narrator.phase = "peak";
  const events = run(game, 60);
  const warned = events.find((event) => event.kind === "incident-warned");
  const started = events.find((event) => event.kind === "incident-started");
  if (warned?.kind !== "incident-warned" || started?.kind !== "incident-started") throw new Error("no threat");
  expect(warned.seconds).toBeGreaterThanOrEqual(narratorConfig.warnMinSeconds);
  expect(warned.seconds).toBeLessThanOrEqual(narratorConfig.warnMaxSeconds);
  expect(started.incident).toBe(warned.incident);
  expect(started.size).toBeGreaterThanOrEqual(1);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toHaveLength(started.size);
  expect(game.narrator.pending).toBeNull();
  expect(game.narrator.active).toBe(started.incident);
  expect(game.narrator.phase).toBe("recovery");
  expect(game.narrator.phaseLeft).toBeGreaterThan(narratorConfig.recoverySeconds - 60);
  expect(game.narrator.phaseLeft).toBeLessThanOrEqual(narratorConfig.recoverySeconds);
  expect(game.narrator.lastPeakAt).toBeGreaterThan(0);
});
it("holds the first peak back for a day, then cycles peak, recovery and buildup", () => {
  const game = narrated();
  addUnit(game, "warrior");
  food(game, { x: 7, y: 2 }, "caterpillar");
  food(game, { x: 7, y: 2 }, "caterpillar");
  food(game, { x: 6, y: 2 }, "caterpillar");
  run(game, narratorConfig.peakIntervalSeconds - 1, true);
  expect(game.narrator.phase).toBe("buildup");
  expect(game.narrator.lastPeakAt).toBe(0);
  run(game, 400, true);
  expect(game.narrator.lastPeakAt).toBeGreaterThanOrEqual(narratorConfig.peakIntervalSeconds);
  expect(game.narrator.phase).toBe("recovery");
  run(game, narratorConfig.recoverySeconds + narratorConfig.minorMaxSeconds, true);
  expect(game.narrator.phase).toBe("buildup");
});
it("never runs two boons at once and closes an expired one", () => {
  const game = narrated();
  game.narrator.phase = "recovery";
  game.narrator.phaseLeft = 10000;
  game.narrator.nextIncidentAt = 0;
  const events = run(game, 900);
  const started = events.filter((event) => event.kind === "incident-started");
  const ended = events.filter((event) => event.kind === "incident-ended");
  expect(started.length).toBeGreaterThan(1);
  expect(ended.length).toBe(started.length - (game.narrator.boon ? 1 : 0));
  expect(events.some((event) => event.kind === "incident-warned")).toBe(false);
  expect(game.units.filter((unit) => unit.faction === "raiders")).toEqual([]);
  let open = 0;
  for (const event of events) {
    if (event.kind === "incident-started") open++;
    if (event.kind === "incident-ended") open--;
    expect(open).toBeLessThanOrEqual(1);
  }
});
it("waits for the running threat to clear before scheduling the next incident", () => {
  const game = narrated();
  game.narrator.active = "raid";
  addUnit(game, "warrior", { x: 8, y: 1 }, "raiders");
  game.narrator.nextIncidentAt = 0;
  game.narrator.census = 4;
  expect(run(game, 300)).toEqual([]);
  expect(game.narrator.pending).toBeNull();
  game.units = game.units.filter((unit) => unit.faction === "colony");
  const events = run(game, 0.05);
  expect(events).toEqual([{ kind: "incident-ended", incident: "raid" }]);
  expect(game.narrator.active).toBeNull();
  expect(game.narrator.lastLoss).toBe(1);
});
it("reports no losses when the previous threat met an empty colony", () => {
  const game = narrated();
  game.narrator.active = "thieves";
  game.narrator.census = 0;
  game.narrator.lastLoss = 0.9;
  expect(run(game, 0.05)).toEqual([{ kind: "incident-ended", incident: "thieves" }]);
  expect(game.narrator.lastLoss).toBe(0);
});
it("keeps a wave between one ant and its cap and scales it with difficulty", () => {
  const game = narrated();
  const raid = incidents.find((incident) => incident.kind === "raid");
  const thieves = incidents.find((incident) => incident.kind === "thieves");
  if (!raid || !thieves) throw new Error("catalog");
  expect(raid.size(game)).toBe(1);
  for (let i = 0; i < 60; i++) addUnit(game, "warrior");
  expect(raid.size(game)).toBe(10);
  expect(thieves.size(game)).toBe(6);
  game.narrator.difficulty = 0.01;
  expect(raid.size(game)).toBe(1);
});
it("alternates wave composition per incident kind", () => {
  expect(raidRoles(5)).toEqual(["worker", "warrior", "worker", "warrior", "worker"]);
  expect(thievesRoles(4)).toEqual(["worker", "scout", "worker", "scout"]);
  expect(raidRoles(0)).toEqual([]);
});
it("leads a boss wave with the beetle and scales its escort from zero to two warriors", () => {
  expect(bossRoles(0)).toEqual(["beetle"]);
  expect(bossRoles(1)).toEqual(["beetle"]);
  expect(bossRoles(2)).toEqual(["beetle", "warrior"]);
  expect(bossRoles(3)).toEqual(["beetle", "warrior", "warrior"]);
});
it("grows the boss escort with colony strength and caps it at three raiders", () => {
  const game = narrated();
  const boss = incidentOf("boss");
  expect(boss.size(game)).toBe(1);
  for (const cell of [
    { x: 7, y: 2 },
    { x: 7, y: 2 },
  ])
    food(game, cell, "caterpillar");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  addUnit(game, "warrior");
  expect(strength(game)).toBe(22);
  expect(boss.size(game)).toBe(1);
  for (let i = 0; i < 3; i++) addUnit(game, "warrior");
  expect(boss.size(game)).toBe(2);
  for (let i = 0; i < 60; i++) addUnit(game, "warrior");
  expect(boss.size(game)).toBe(3);
});
it("raises the boss weight once the colony fields two warriors and still spares a weak colony", () => {
  const alone = { consumptions: 3, warriors: 1, queenHurt: false, freeEggs: 0, lastLoss: 0, weak: false };
  const armed = { ...alone, warriors: narratorConfig.bossWarriors };
  const boss = incidentOf("boss");
  expect(boss.weight(alone)).toBeCloseTo(narratorConfig.bossWeight, 8);
  expect(boss.weight(armed)).toBeCloseTo(narratorConfig.bossWeight + narratorConfig.bossArmedWeight, 8);
  expect(boss.weight(armed)).toBeGreaterThan(boss.weight(alone));
  expect(incidentWeight(boss, { ...armed, weak: true })).toBeCloseTo(
    boss.weight(armed) * narratorConfig.mercyThreat,
    8,
  );
});
it("hands work the default forage table and speeds it up or enriches it under a boon", () => {
  const game = narrated();
  expect(forageWeights(game)).toBe(forageWeight);
  expect(forageSeconds(game, 0)).toBe(FORAGE_MIN_SECONDS);
  expect(forageSeconds(game, 1)).toBe(FORAGE_MAX_SECONDS);
  game.narrator.boon = { kind: "rich-forage", until: 1000 };
  expect(forageWeights(game)).toBe(richForageWeight);
  expect(richForageWeight.caterpillar).toBeGreaterThan(forageWeight.caterpillar);
  expect(forageSeconds(game, 1)).toBe(FORAGE_MAX_SECONDS);
  game.narrator.boon = { kind: "food-nearby", until: 1000 };
  expect(forageWeights(game)).toBe(forageWeight);
  expect(forageSeconds(game, 0)).toBe(NEARBY_MIN_SECONDS);
  expect(forageSeconds(game, 1)).toBe(NEARBY_MAX_SECONDS);
});
it("seeds a fresh game from the seed argument and stays reproducible through the simulation", () => {
  const first = createGame(() => 0.5, 123);
  const second = createGame(() => 0.5, 123);
  const other = createGame(() => 0.5, 456);
  expect(first.narrator.rng).toBe(second.narrator.rng);
  expect(first.narrator.rng).not.toBe(other.narrator.rng);
  expect(advance(first, 60)).toEqual(advance(second, 60));
  expect(first.narrator).toEqual(second.narrator);
  expect(createGame(() => 0.25).narrator.rng).toBe(createNarrator(0.25 * 4294967296).rng);
});
