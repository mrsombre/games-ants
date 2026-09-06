import { describe, expect, it } from "vitest";
import { pauseNarrator, setDifficulty } from "./debug";
import { type GameEvent, SIMULATION_STEP } from "./model";
import { advanceNarrator, createNarrator, settleIncidents } from "./narrator";
import { advance, world } from "./test-support";

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
