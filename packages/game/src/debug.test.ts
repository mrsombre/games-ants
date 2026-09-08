import { describe, expect, it } from "vitest";
import { COLS, cellKey, EXIT, HOME, ROWS } from "./cells";
import type { BuildTool } from "./colony";
import { DAY_PHASE_IDS, DAY_PHASES, type DayPhaseId, dayPhase } from "./day-cycle";
import { buildCell, clearBuilt, jumpToPhase, setFood, skipTime, spawnUnit } from "./debug";
import type { GameEvent } from "./model";
import { foodStock, STORAGE_SLOTS, storedFood } from "./storage";
import { addUnit, advance, egg, food, world } from "./test-support";
import { applyTool, toolError } from "./tools";
import type { Faction, Role } from "./units";

describe("day jump", () => {
  it("puts the clock at the start of the requested day phase", () => {
    for (const [day, phase, expected] of [
      [1, "noon", 150],
      [1, "night", 450],
      [2, "morning", 600],
      [4, "evening", 2100],
    ] as const) {
      const game = world();
      expect(jumpToPhase(game, day, phase)).toBe(null);
      expect(game.elapsedSeconds).toBe(expected);
      expect(dayPhase(game.elapsedSeconds) % DAY_PHASES.length).toBe(DAY_PHASE_IDS.indexOf(phase));
      expect(Math.floor(dayPhase(game.elapsedSeconds) / DAY_PHASES.length) + 1).toBe(day);
    }
  });
  it("refuses a jump backwards or onto the current moment and keeps the clock", () => {
    const game = world();
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
    const game = world();
    expect(jumpToPhase(game, 1, "dusk" as DayPhaseId)).toBe(
      "Телепорт времени: неизвестная фаза, нужна одна из morning, noon, evening, night",
    );
    for (const day of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(jumpToPhase(game, day, "night")).toBe("Телепорт времени: день — целое число от 1");
    expect(game.elapsedSeconds).toBe(0);
  });
  it("does not live through the skipped time: a blueprint stays unbuilt", () => {
    const game = world();
    addUnit(game, "worker", { x: 8, y: 3 });
    expect(applyTool(game, "corridor", 8, 6)).toBe(null);
    expect(jumpToPhase(game, 2, "morning")).toBe(null);
    expect(game.colony["8,6"]).toBeUndefined();
  });
  it("leaves relative timers alone", () => {
    const game = world();
    advance(game, 30);
    const { eggTimer, nestTimer } = game;
    expect(jumpToPhase(game, 3, "evening")).toBe(null);
    expect({ eggTimer: game.eggTimer, nestTimer: game.nestTimer }).toEqual({ eggTimer, nestTimer });
  });
});

describe("skip", () => {
  it("advances the clock by the requested seconds", () => {
    const game = world();
    expect(skipTime(game, 120, [])).toBe(null);
    expect(game.elapsedSeconds).toBeCloseTo(120, 6);
  });
  it("simulates the time: a blueprint gets built", () => {
    const game = world();
    addUnit(game, "worker", { x: 8, y: 3 });
    expect(applyTool(game, "corridor", 8, 6)).toBe(null);
    expect(game.colony["8,6"]).toBeUndefined();
    expect(skipTime(game, 300, [])).toBe(null);
    expect(game.colony["8,6"]).toBe("corridor");
  });
  it("refuses more than a game day and does not move the clock", () => {
    const game = world();
    const events: GameEvent[] = [];
    expect(skipTime(game, 601, events)).toBe("Перемотка: не больше 600 с за вызов");
    expect(game.elapsedSeconds).toBe(0);
    expect(events).toEqual([]);
    expect(skipTime(game, 600, [])).toBe(null);
  });
  it("refuses seconds that are not a positive finite number", () => {
    for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "60" as unknown as number]) {
      const game = world();
      expect(skipTime(game, seconds, [])).toBe("Перемотка: нужно положительное число секунд");
      expect(game.elapsedSeconds).toBe(0);
    }
  });
});

describe("spawn", () => {
  const found = (game: ReturnType<typeof world>, role: Role) => game.units.filter((unit) => unit.role === role);
  it("puts a unit of the asked role in the asked cell and takes its id from the counter", () => {
    const game = world();
    const id = game.nextUnitId;
    expect(spawnUnit(game, "warrior", 6, 4)).toBe(null);
    expect(game.nextUnitId).toBe(id + 1);
    const unit = found(game, "warrior")[0];
    expect(unit).toMatchObject({ id, role: "warrior", faction: "colony", cell: { x: 6, y: 4 }, hp: 24 });
  });
  it("makes the unit take part in the next step: a spawned beetle bites the queen", () => {
    const game = world();
    const queen = found(game, "queen")[0];
    expect(queen).toBeDefined();
    expect(spawnUnit(game, "beetle", HOME.x, HOME.y)).toBe(null);
    advance(game, 5);
    expect(queen?.hp).toBeLessThan(queen?.maxHp ?? 0);
  });
  it("defaults the faction to raiders for beetle and spider and to colony for ants", () => {
    const game = world();
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
    const game = world();
    expect(spawnUnit(game, "beetle", 4, 0, "colony")).toBe(null);
    expect(found(game, "beetle")[0]?.faction).toBe("colony");
    expect(spawnUnit(game, "worker", 5, 0, "raiders")).toBe(null);
    expect(found(game, "worker")[0]?.faction).toBe("raiders");
  });
  it("spawns into unbuilt ground and the unit stays there through the next steps", () => {
    const game = world();
    expect(game.colony["2,9"]).toBeUndefined();
    expect(spawnUnit(game, "scout", 2, 9)).toBe(null);
    advance(game, 10);
    expect(found(game, "scout")[0]?.cell).toEqual({ x: 2, y: 9 });
  });
  it("ignores nest capacity: the colony grows past its free places", () => {
    const game = world();
    const before = game.units.length;
    for (let index = 0; index < 40; index++) expect(spawnUnit(game, "worker", 8, 3)).toBe(null);
    expect(game.units.length).toBe(before + 40);
  });
  it("refuses a second queen while one is alive and adds nothing", () => {
    const game = world();
    const before = game.units.length;
    expect(spawnUnit(game, "queen", 6, 4)).toBe("Спавн: матка в колонии одна, вторую поставить нельзя");
    expect(game.units.length).toBe(before);
  });
  it("allows a queen once the old one is dead", () => {
    const game = world();
    const queen = found(game, "queen")[0];
    if (queen) queen.hp = 0;
    expect(spawnUnit(game, "queen", 6, 4)).toBe(null);
    expect(found(game, "queen").filter((unit) => unit.hp > 0).length).toBe(1);
  });
  it("accepts the service cells at both ends of the surface", () => {
    const game = world();
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
      const game = world();
      const before = game.units.length;
      expect(spawnUnit(game, "worker", x, y)).toBe(outside);
      expect(game.units.length).toBe(before);
    }
  });
  it("accepts the corners of the map grid", () => {
    const game = world();
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
    const game = world();
    expect(spawnUnit(game, "ladybug" as Role, 6, 4)).toBe(
      "Спавн: неизвестная роль, нужна одна из worker, scout, warrior, queen, beetle, spider",
    );
    expect(spawnUnit(game, "worker", 6, 4, "neutral" as Faction)).toBe(
      "Спавн: неизвестная фракция, нужна одна из colony, raiders",
    );
    expect(game.units.length).toBe(1);
    expect(game.nextUnitId).toBe(world().nextUnitId);
  });
});

describe("food", () => {
  it("fills empty storage up to the wanted stock with one-portion apples", () => {
    const game = world();
    expect(setFood(game, 4)).toBe(null);
    expect(foodStock(game)).toBe(4);
    expect(storedFood(game).map((item) => [item.food, item.portions])).toEqual([
      ["apple", 1],
      ["apple", 1],
      ["apple", 1],
      ["apple", 1],
    ]);
  });
  it("spreads the apples over several storage cells without overfilling one", () => {
    const game = world();
    expect(setFood(game, 6)).toBe(null);
    expect(foodStock(game)).toBe(6);
    for (const id of ["6,2", "7,2"]) expect(foodStock(game, id)).toBe(STORAGE_SLOTS);
  });
  it("cuts the stock down to the wanted number and drops emptied items", () => {
    const game = world();
    food(game, { x: 6, y: 2 }, "caterpillar");
    food(game, { x: 6, y: 2 });
    expect(setFood(game, 1)).toBe(null);
    expect(foodStock(game)).toBe(1);
    expect(storedFood(game).length).toBe(1);
  });
  it("empties the storage on zero", () => {
    const game = world();
    food(game, { x: 6, y: 2 });
    expect(setFood(game, 0)).toBe(null);
    expect(foodStock(game)).toBe(0);
    expect(storedFood(game)).toEqual([]);
  });
  it("keeps the stock when it already matches", () => {
    const game = world();
    const item = food(game, { x: 6, y: 2 }, "caterpillar");
    expect(setFood(game, 2)).toBe(null);
    expect(storedFood(game)).toEqual([item]);
  });
  it("refuses more than the storage holds and changes nothing", () => {
    const game = world();
    expect(setFood(game, 7)).toBe("Еда: на складе помещается не больше 6");
    expect(foodStock(game)).toBe(0);
    expect(game.items).toEqual([]);
  });
  it("counts the stock already in place when checking the capacity", () => {
    const game = world();
    food(game, { x: 6, y: 2 }, "caterpillar");
    expect(setFood(game, 6)).toBe(null);
    expect(foodStock(game)).toBe(6);
    expect(setFood(game, 7)).toBe("Еда: на складе помещается не больше 6");
  });
  it("refuses negative and non-integer numbers and changes nothing", () => {
    for (const amount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2" as unknown as number]) {
      const game = world();
      expect(setFood(game, amount)).toBe("Еда: нужно целое неотрицательное число");
      expect(game.items).toEqual([]);
    }
  });
});

describe("build", () => {
  it("places a finished cell at once: no blueprint is left and the revision grows", () => {
    const game = world();
    const before = game.revision;
    expect(buildCell(game, 8, 6, "corridor")).toBe(null);
    expect(game.colony["8,6"]).toBe("corridor");
    expect(game.blueprints).toEqual({});
    expect(game.revision).toBeGreaterThan(before);
  });
  it("refuses by the regular placement rules with the same reason as the tool", () => {
    for (const [x, y, tile] of [
      [5, 9, "nest"],
      [2, 4, "corridor"],
      [8, 3, "corridor"],
      [8, 1, "corridor"],
      [-1, 4, "corridor"],
    ] as const) {
      const game = world();
      const expected = toolError(game, tile, x, y);
      const colony = { ...game.colony };
      expect(expected).not.toBe(null);
      expect(buildCell(game, x, y, tile)).toBe(expected);
      expect(game.colony).toEqual(colony);
      expect(game.revision).toBe(0);
    }
  });
  it("creates with force a cell the placement rules would reject and grows the revision", () => {
    const game = world();
    expect(toolError(game, "nest", 2, 9)).not.toBe(null);
    expect(buildCell(game, 2, 9, "nest", { force: true })).toBe(null);
    expect(game.colony["2,9"]).toBe("nest");
    expect(game.revision).toBeGreaterThan(0);
  });
  it("replaces an existing tile with force", () => {
    const game = world();
    expect(buildCell(game, 8, 4, "storage", { force: true })).toBe(null);
    expect(game.colony["8,4"]).toBe("storage");
  });
  it("refuses the top two rows and cells off the map even with force", () => {
    for (const [x, y] of [
      [8, 0],
      [8, 1],
    ] as const) {
      const game = world();
      expect(buildCell(game, x, y, "corridor", { force: true })).toBe("Постройка: ряды 0 и 1 закрыты");
      expect(game.revision).toBe(0);
    }
    for (const [x, y] of [
      [-1, 4],
      [COLS, 4],
      [4, ROWS],
      [4.5, 4],
    ] as const) {
      const game = world();
      expect(buildCell(game, x, y, "corridor", { force: true })).toBe("Постройка: клетка вне карты");
      expect(game.colony[`${x},${y}`]).toBe(undefined);
      expect(game.revision).toBe(0);
    }
  });
  it("refuses an unknown tile with and without force", () => {
    for (const force of [false, true]) {
      const game = world();
      expect(buildCell(game, 8, 6, "tunnel" as BuildTool, { force })).toBe(
        "Постройка: неизвестный тип, нужен один из corridor, nest, storage",
      );
      expect(game.revision).toBe(0);
    }
  });
  it("leaves a built cell workable: ants use it in the simulation", () => {
    const game = world();
    expect(buildCell(game, 8, 6, "corridor")).toBe(null);
    expect(applyTool(game, "corridor", 8, 7)).toBe(null);
  });
});

describe("clear", () => {
  it("demolishes at once and grows the revision", () => {
    const game = world();
    const before = game.revision;
    expect(clearBuilt(game, 8, 5)).toBe(null);
    expect(game.colony["8,5"]).toBe(undefined);
    expect(game.revision).toBeGreaterThan(before);
  });
  it("refuses by the regular demolition rules with the same reason as the tool", () => {
    for (const [x, y] of [
      [10, 3],
      [8, 3],
      [4, 4],
      [8, 1],
      [-1, 4],
    ] as const) {
      const game = world();
      const expected = toolError(game, "demolish", x, y);
      expect(expected).not.toBe(null);
      expect(clearBuilt(game, x, y)).toBe(expected);
      expect(game.revision).toBe(0);
    }
  });
  it("removes a protected cell with force and grows the revision", () => {
    const game = world();
    expect(toolError(game, "demolish", 10, 3)).not.toBe(null);
    expect(clearBuilt(game, 10, 3, { force: true })).toBe(null);
    expect(game.colony["10,3"]).toBe(undefined);
    expect(game.revision).toBeGreaterThan(0);
  });
  it("settles the aftermath with force: a unit standing there steps into a neighbour", () => {
    const game = world();
    const unit = addUnit(game, "worker", { x: 10, y: 3 });
    expect(clearBuilt(game, 10, 3, { force: true })).toBe(null);
    expect(unit.cell).not.toEqual({ x: 10, y: 3 });
    expect(game.colony[cellKey(unit.cell)]).toBeDefined();
  });
  it("leaves items of a forced clear in the ground", () => {
    const game = world();
    const item = egg(game, { x: 10, y: 3 });
    expect(clearBuilt(game, 10, 3, { force: true })).toBe(null);
    expect(game.items).toEqual([item]);
  });
  it("refuses the top two rows and cells off the map even with force", () => {
    for (const [x, y] of [
      [8, 0],
      [8, 1],
    ] as const) {
      const game = world();
      expect(clearBuilt(game, x, y, { force: true })).toBe("Снос: ряды 0 и 1 закрыты");
      expect(game.colony["8,1"]).toBe("corridor");
      expect(game.revision).toBe(0);
    }
    for (const [x, y] of [
      [-1, 4],
      [COLS, 4],
      [4, ROWS],
      [4.5, 4],
    ] as const) {
      const game = world();
      expect(clearBuilt(game, x, y, { force: true })).toBe("Снос: клетка вне карты");
      expect(game.revision).toBe(0);
    }
  });
});
