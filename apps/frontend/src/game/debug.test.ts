import { describe, expect, it } from "vitest";
import { DAY_PHASE_IDS, DAY_PHASES, type DayPhaseId, dayPhase } from "./day-cycle";
import { jumpToPhase, pauseNarrator, setDifficulty, skipTime } from "./debug";
import { type GameEvent, SIMULATION_STEP } from "./model";
import { advanceNarrator, createNarrator, settleIncidents } from "./narrator";
import { addUnit, advance, world } from "./test-support";
import { applyTool } from "./tools";

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
