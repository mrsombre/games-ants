import { describe, expect, it } from "vitest";
import { COLS, EXIT, HOME, ROWS } from "./cells";
import { DAY_PHASE_IDS, DAY_PHASES, type DayPhaseId, dayPhase } from "./day-cycle";
import { jumpToPhase, pauseNarrator, setDifficulty, skipTime, spawnUnit, startIncidentNow } from "./debug";
import { type GameEvent, SIMULATION_STEP } from "./model";
import { advanceNarrator, createNarrator, incidentOf, settleIncidents } from "./narrator";
import { addUnit, advance, world } from "./test-support";
import { applyTool } from "./tools";
import type { Faction, Role } from "./units";

function narrated(difficulty = 1) {
  const game = world();
  game.narrator = createNarrator(11, difficulty);
  return game;
}
// Raiders are repelled every step so that a finished threat never blocks the next one.
function narrate(game: ReturnType<typeof narrated>, seconds: number) {
  const events: GameEvent[] = [];
  for (let step = 0; step < Math.round(seconds / SIMULATION_STEP); step++) {
    game.elapsedSeconds += SIMULATION_STEP;
    advanceNarrator(game, SIMULATION_STEP, events);
    game.units = game.units.filter((unit) => unit.faction === "colony");
    settleIncidents(game, events);
  }
  return events;
}
const incidentEvents = (events: readonly GameEvent[]) =>
  events.filter((event) => event.kind === "incident-warned" || event.kind === "incident-started");

describe("difficulty", () => {
  it("sets the narrator multiplier and reports success", () => {
    const game = narrated();
    expect(setDifficulty(game, 2.5)).toBe(null);
    expect(game.narrator.difficulty).toBe(2.5);
  });
  it("refuses values that are not finite non-negative numbers and keeps the multiplier", () => {
    for (const value of [-1, -0.001, Number.NaN, Number.POSITIVE_INFINITY, "2" as unknown as number]) {
      const game = narrated(1);
      expect(setDifficulty(game, value)).toBe("Темп нарратора: нужно конечное неотрицательное число");
      expect(game.narrator.difficulty).toBe(1);
    }
  });
  it("accepts zero and the narrator then plans nothing", () => {
    const game = narrated();
    expect(setDifficulty(game, 0)).toBe(null);
    expect(incidentEvents(advance(game, 600))).toEqual([]);
  });
  it("speeds up the narrator: a higher multiplier brings more incidents", () => {
    const count = (difficulty: number) => {
      const game = narrated();
      expect(setDifficulty(game, difficulty)).toBe(null);
      return incidentEvents(narrate(game, 900)).length;
    };
    expect(count(4)).toBeGreaterThan(count(1));
  });
});

describe("pause", () => {
  it("silences the narrator: no incident is planned or started afterwards", () => {
    const game = narrated();
    expect(incidentEvents(advance(game, 600)).length).toBeGreaterThan(0);
    const paused = narrated();
    expect(pauseNarrator(paused)).toBe(null);
    expect(paused.narrator.difficulty).toBe(0);
    expect(incidentEvents(advance(paused, 600))).toEqual([]);
  });
  it("stops a narrator that was already running", () => {
    const game = narrated();
    advance(game, 60);
    pauseNarrator(game);
    expect(incidentEvents(advance(game, 600))).toEqual([]);
  });
});

describe("day jump", () => {
  it("puts the clock at the start of the requested day phase", () => {
    for (const [day, phase, expected] of [
      [1, "noon", 150],
      [1, "night", 450],
      [2, "morning", 600],
      [4, "evening", 2100],
    ] as const) {
      const game = narrated();
      expect(jumpToPhase(game, day, phase)).toBe(null);
      expect(game.elapsedSeconds).toBe(expected);
      expect(dayPhase(game.elapsedSeconds) % DAY_PHASES.length).toBe(DAY_PHASE_IDS.indexOf(phase));
      expect(Math.floor(dayPhase(game.elapsedSeconds) / DAY_PHASES.length) + 1).toBe(day);
    }
  });
  it("refuses a jump backwards or onto the current moment and keeps the clock", () => {
    const game = narrated();
    advance(game, 300);
    const before = game.elapsedSeconds;
    for (const [day, phase] of [
      [1, "morning"],
      [1, "noon"],
      [1, "evening"],
    ] as const) {
      expect(jumpToPhase(game, day, phase)).toBe("Телепорт времени: только вперёд, назад и на месте нельзя");
      expect(game.elapsedSeconds).toBe(before);
    }
  });
  it("refuses an unknown phase or a day that is not a whole number from 1", () => {
    const game = narrated();
    expect(jumpToPhase(game, 1, "dusk" as DayPhaseId)).toBe(
      "Телепорт времени: неизвестная фаза, нужна одна из morning, noon, evening, night",
    );
    for (const day of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(jumpToPhase(game, day, "night")).toBe("Телепорт времени: день — целое число от 1");
    expect(game.elapsedSeconds).toBe(0);
  });
  it("carries a pending threat along, so the jump does not fire it", () => {
    const game = narrated();
    for (let step = 0; step < 12000 && !game.narrator.pending; step++) advance(game, SIMULATION_STEP);
    expect(game.narrator.pending).not.toBe(null);
    const left = (game.narrator.pending?.at ?? 0) - game.elapsedSeconds;
    expect(jumpToPhase(game, 9, "morning")).toBe(null);
    expect(advance(game, SIMULATION_STEP).filter((event) => event.kind === "incident-started")).toEqual([]);
    expect((game.narrator.pending?.at ?? 0) - game.elapsedSeconds).toBeCloseTo(left - SIMULATION_STEP, 6);
  });
  it("carries a boon along, so the jump does not end it", () => {
    const game = narrated();
    game.narrator.boon = { kind: "rich-forage", until: game.elapsedSeconds + 150 };
    expect(jumpToPhase(game, 5, "night")).toBe(null);
    expect(advance(game, SIMULATION_STEP).filter((event) => event.kind === "incident-ended")).toEqual([]);
    expect(game.narrator.boon?.until).toBe(game.elapsedSeconds + 150 - SIMULATION_STEP);
  });
  it("carries a lasting threat along, so the jump does not end it", () => {
    const game = narrated();
    game.narrator.active = "flood";
    game.narrator.effect = { kind: "flood", until: game.elapsedSeconds + 100 };
    expect(jumpToPhase(game, 5, "night")).toBe(null);
    expect(advance(game, SIMULATION_STEP).filter((event) => event.kind === "incident-ended")).toEqual([]);
    expect(game.narrator.effect?.until).toBe(game.elapsedSeconds + 100 - SIMULATION_STEP);
  });
  it("keeps the peak interval, so the jump alone does not force a peak", () => {
    const game = narrated();
    advance(game, 60);
    const since = game.elapsedSeconds - game.narrator.lastPeakAt;
    expect(jumpToPhase(game, 20, "noon")).toBe(null);
    expect(game.elapsedSeconds - game.narrator.lastPeakAt).toBeCloseTo(since, 6);
  });
  it("carries the next incident deadline along, so the jump does not plan one right away", () => {
    const game = narrated();
    const planned = game.narrator.nextIncidentAt;
    expect(planned).toBeGreaterThan(0);
    expect(jumpToPhase(game, 7, "noon")).toBe(null);
    expect(incidentEvents(advance(game, SIMULATION_STEP))).toEqual([]);
    expect(game.narrator.nextIncidentAt - game.elapsedSeconds).toBeCloseTo(planned - SIMULATION_STEP, 6);
  });
  it("does not live through the skipped time: a blueprint stays unbuilt", () => {
    const game = narrated();
    addUnit(game, "worker", { x: 8, y: 3 });
    expect(applyTool(game, "corridor", 8, 6)).toBe(null);
    expect(jumpToPhase(game, 2, "morning")).toBe(null);
    expect(game.colony["8,6"]).toBeUndefined();
  });
  it("leaves relative timers alone", () => {
    const game = narrated();
    advance(game, 30);
    const { eggTimer, nestTimer } = game;
    expect(jumpToPhase(game, 3, "evening")).toBe(null);
    expect({ eggTimer: game.eggTimer, nestTimer: game.nestTimer }).toEqual({ eggTimer, nestTimer });
  });
});

describe("skip", () => {
  it("advances the clock by the requested seconds", () => {
    const game = narrated();
    expect(skipTime(game, 120, [])).toBe(null);
    expect(game.elapsedSeconds).toBeCloseTo(120, 6);
  });
  it("simulates the time: a blueprint gets built", () => {
    const game = narrated();
    addUnit(game, "worker", { x: 8, y: 3 });
    expect(applyTool(game, "corridor", 8, 6)).toBe(null);
    expect(game.colony["8,6"]).toBeUndefined();
    expect(skipTime(game, 300, [])).toBe(null);
    expect(game.colony["8,6"]).toBe("corridor");
  });
  it("collects the events raised while skipping", () => {
    const game = narrated(1);
    const events: GameEvent[] = [];
    expect(skipTime(game, 600, events)).toBe(null);
    expect(incidentEvents(events).length).toBeGreaterThan(0);
  });
  it("refuses more than a game day and does not move the clock", () => {
    const game = narrated();
    const events: GameEvent[] = [];
    expect(skipTime(game, 601, events)).toBe("Перемотка: не больше 600 с за вызов");
    expect(game.elapsedSeconds).toBe(0);
    expect(events).toEqual([]);
    expect(skipTime(game, 600, [])).toBe(null);
  });
  it("refuses seconds that are not a positive finite number", () => {
    for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "60" as unknown as number]) {
      const game = narrated();
      expect(skipTime(game, seconds, [])).toBe("Перемотка: нужно положительное число секунд");
      expect(game.elapsedSeconds).toBe(0);
    }
  });
});

describe("incident", () => {
  const raiders = (game: ReturnType<typeof narrated>) => game.units.filter((unit) => unit.faction === "raiders");
  it("starts a wave at once: raiders appear and the start event is raised", () => {
    const game = narrated();
    const events: GameEvent[] = [];
    expect(startIncidentNow(game, "raid", events)).toBe(null);
    expect(raiders(game).length).toBeGreaterThan(0);
    expect(events).toEqual([{ kind: "incident-started", incident: "raid", size: raiders(game).length }]);
    expect(game.narrator.active).toBe("raid");
  });
  it("uses the regular size formula by default", () => {
    const game = narrated();
    const expected = incidentOf("raid").size(game);
    expect(startIncidentNow(game, "raid", [])).toBe(null);
    expect(raiders(game).length).toBe(expected);
  });
  it("takes an explicit size", () => {
    const game = narrated();
    expect(startIncidentNow(game, "raid", [], 4)).toBe(null);
    expect(raiders(game).length).toBe(4);
  });
  it("starts while the narrator is paused", () => {
    const game = narrated(0);
    const events: GameEvent[] = [];
    expect(startIncidentNow(game, "raid", events, 2)).toBe(null);
    expect(raiders(game).length).toBe(2);
    expect(events.length).toBe(1);
  });
  it("stacks a second wave on top of an active threat", () => {
    const game = narrated();
    expect(startIncidentNow(game, "raid", [], 2)).toBe(null);
    const events: GameEvent[] = [];
    expect(startIncidentNow(game, "thieves", events, 3)).toBe(null);
    expect(raiders(game).length).toBe(5);
    expect(game.narrator.active).toBe("thieves");
    expect(events).toEqual([{ kind: "incident-started", incident: "thieves", size: 3 }]);
  });
  it("starts a boon in any tension phase, ignoring the phase allow list", () => {
    const game = narrated();
    game.narrator.phase = "peak";
    const events: GameEvent[] = [];
    expect(startIncidentNow(game, "rich-forage", events, 1)).toBe(null);
    expect(game.narrator.boon?.kind).toBe("rich-forage");
    expect(game.narrator.active).toBe(null);
    expect(events).toEqual([{ kind: "incident-started", incident: "rich-forage", size: 1 }]);
  });
  it("moves the peak phase to recovery like the regular start does", () => {
    const game = narrated();
    game.narrator.phase = "peak";
    game.elapsedSeconds = 700;
    expect(startIncidentNow(game, "raid", [], 1)).toBe(null);
    expect(game.narrator.phase).toBe("recovery");
    expect(game.narrator.lastPeakAt).toBe(700);
  });
  it("refuses an unknown kind and changes nothing", () => {
    const game = narrated();
    const events: GameEvent[] = [];
    expect(startIncidentNow(game, "swarm" as never, events)).toBe(
      "Инцидент: неизвестный вид, нужен один из raid, thieves, boss, flood, predator, rich-forage, food-nearby",
    );
    expect(raiders(game)).toEqual([]);
    expect(game.narrator.active).toBe(null);
    expect(events).toEqual([]);
  });
  it("refuses a size that is not an integer of at least one", () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2" as unknown as number]) {
      const game = narrated();
      expect(startIncidentNow(game, "raid", [], size)).toBe("Инцидент: размер — целое число от 1");
      expect(raiders(game)).toEqual([]);
      expect(game.narrator.active).toBe(null);
    }
  });
});

describe("spawn", () => {
  const found = (game: ReturnType<typeof narrated>, role: Role) => game.units.filter((unit) => unit.role === role);
  it("puts a unit of the asked role in the asked cell and takes its id from the counter", () => {
    const game = narrated();
    const id = game.nextUnitId;
    expect(spawnUnit(game, "warrior", 6, 4)).toBe(null);
    expect(game.nextUnitId).toBe(id + 1);
    const unit = found(game, "warrior")[0];
    expect(unit).toMatchObject({ id, role: "warrior", faction: "colony", cell: { x: 6, y: 4 }, hp: 24 });
  });
  it("makes the unit take part in the next step: a spawned beetle bites the queen", () => {
    const game = narrated();
    const queen = found(game, "queen")[0];
    expect(queen).toBeDefined();
    expect(spawnUnit(game, "beetle", HOME.x, HOME.y)).toBe(null);
    advance(game, 5);
    expect(queen?.hp).toBeLessThan(queen?.maxHp ?? 0);
  });
  it("defaults the faction to raiders for beetle and spider and to colony for ants", () => {
    const game = narrated();
    for (const [role, faction] of [
      ["beetle", "raiders"],
      ["spider", "raiders"],
      ["worker", "colony"],
      ["scout", "colony"],
      ["warrior", "colony"],
    ] as const) {
      expect(spawnUnit(game, role, 4, 0)).toBe(null);
      expect(found(game, role)[0]?.faction).toBe(faction);
    }
  });
  it("lets an explicit faction override the default in both directions", () => {
    const game = narrated();
    expect(spawnUnit(game, "beetle", 4, 0, "colony")).toBe(null);
    expect(found(game, "beetle")[0]?.faction).toBe("colony");
    expect(spawnUnit(game, "worker", 5, 0, "raiders")).toBe(null);
    expect(found(game, "worker")[0]?.faction).toBe("raiders");
  });
  it("spawns into unbuilt ground and the unit stays there through the next steps", () => {
    const game = narrated();
    expect(game.colony["2,9"]).toBeUndefined();
    expect(spawnUnit(game, "scout", 2, 9)).toBe(null);
    advance(game, 10);
    expect(found(game, "scout")[0]?.cell).toEqual({ x: 2, y: 9 });
  });
  it("ignores nest capacity: the colony grows past its free places", () => {
    const game = narrated();
    const before = game.units.length;
    for (let index = 0; index < 40; index++) expect(spawnUnit(game, "worker", 8, 3)).toBe(null);
    expect(game.units.length).toBe(before + 40);
  });
  it("refuses a second queen while one is alive and adds nothing", () => {
    const game = narrated();
    const before = game.units.length;
    expect(spawnUnit(game, "queen", 6, 4)).toBe("Спавн: матка в колонии одна, вторую поставить нельзя");
    expect(game.units.length).toBe(before);
  });
  it("allows a queen once the old one is dead", () => {
    const game = narrated();
    const queen = found(game, "queen")[0];
    if (queen) queen.hp = 0;
    expect(spawnUnit(game, "queen", 6, 4)).toBe(null);
    expect(found(game, "queen").filter((unit) => unit.hp > 0).length).toBe(1);
  });
  it("accepts the service cells at both ends of the surface", () => {
    const game = narrated();
    for (const cell of [EXIT, { x: COLS, y: 0 }]) {
      expect(spawnUnit(game, "warrior", cell.x, cell.y, "raiders")).toBe(null);
    }
    expect(found(game, "warrior").map((unit) => unit.cell)).toEqual([EXIT, { x: COLS, y: 0 }]);
  });
  it("refuses a cell that is neither on the map nor a service cell and adds nothing", () => {
    const outside = `Спавн: клетка вне карты, нужна клетка сетки или служебная (-1,0) / (${COLS},0)`;
    for (const [x, y] of [
      [-1, 1],
      [COLS, 1],
      [-2, 0],
      [COLS + 1, 0],
      [0, -1],
      [0, ROWS],
      [1.5, 2],
      [2, 1.5],
      [Number.NaN, 0],
    ] as const) {
      const game = narrated();
      const before = game.units.length;
      expect(spawnUnit(game, "worker", x, y)).toBe(outside);
      expect(game.units.length).toBe(before);
    }
  });
  it("accepts the corners of the map grid", () => {
    const game = narrated();
    for (const [x, y] of [
      [0, 0],
      [COLS - 1, 0],
      [0, ROWS - 1],
      [COLS - 1, ROWS - 1],
    ] as const)
      expect(spawnUnit(game, "worker", x, y)).toBe(null);
    expect(found(game, "worker").length).toBe(4);
  });
  it("refuses an unknown role or faction and adds nothing", () => {
    const game = narrated();
    expect(spawnUnit(game, "ladybug" as Role, 6, 4)).toBe(
      "Спавн: неизвестная роль, нужна одна из worker, scout, warrior, queen, beetle, spider",
    );
    expect(spawnUnit(game, "worker", 6, 4, "neutral" as Faction)).toBe(
      "Спавн: неизвестная фракция, нужна одна из colony, raiders",
    );
    expect(game.units.length).toBe(1);
    expect(game.nextUnitId).toBe(narrated().nextUnitId);
  });
});
