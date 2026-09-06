import { Container, Graphics } from "pixi.js";
import { cellKey, point } from "../cells";
import { EGG_SECONDS } from "../eggs";
import type { FoodKind } from "../items";
import { type Game, queenOf } from "../model";
import { position } from "../navigation";
import { foodStock } from "../storage";
import { present, type Unit } from "../units";
import { roles } from "./appearance";
import { foodSlotX } from "./colony";
import { CELL, SURFACE } from "./layout";
import { drawCrown, drawQueen } from "./queen";

export function createCreatures() {
  const layer = new Container();
  const construction = new Graphics();
  const eggs = new Graphics();
  const queen = new Graphics();
  const queenOverlay = new Graphics();
  const creatures = new Container();
  layer.addChild(construction, eggs, queen, queenOverlay, creatures);
  const sprites = new Map<number, Graphics>();
  function renderSimulation(game: Game, time: number) {
    drawBlueprints(construction, game.blueprints);
    drawEggs(eggs, game);
    queen.clear();
    queenOverlay.clear();
    const queenUnit = queenOf(game);
    if (queenUnit && queenUnit.hp > 0) {
      const spot = position(queenUnit);
      const x = spot.x * CELL,
        y = SURFACE + spot.y * CELL;
      drawQueen(queen, time, queenUnit.route.length > 0);
      queen.position.set(x + CELL / 2, y + CELL / 2 + 2);
      queen.rotation = queenUnit.heading;
      drawCrown(queenOverlay, x + CELL / 2, y + 12);
      if (queenUnit.hp < queenUnit.maxHp) {
        queenOverlay.roundRect(x + 6, y + 3, 40, 3, 1).fill(0x56382d);
        queenOverlay.roundRect(x + 6, y + 3, (40 * queenUnit.hp) / queenUnit.maxHp, 3, 1).fill(0xa9df79);
      }
    }
    const living = game.units.filter((unit) => unit.role !== "queen");
    const ids = new Set(living.map((ant) => ant.id));
    for (const [id, sprite] of sprites) {
      if (!ids.has(id)) {
        sprite.destroy();
        sprites.delete(id);
      }
    }
    const cargoByUnit = new Map(
      game.items.flatMap((item) => (item.location.kind === "carried" ? [[item.location.unitId, item] as const] : [])),
    );
    for (const ant of living) {
      let sprite = sprites.get(ant.id);
      if (!sprite) {
        sprite = new Graphics();
        sprites.set(ant.id, sprite);
        creatures.addChild(sprite);
      }
      sprite.visible = present(ant);
      if (!sprite.visible) continue;
      const cargo = cargoByUnit.get(ant.id);
      drawAnt(sprite, ant, time, cargo?.kind === "egg", cargo?.kind === "food" ? cargo.food : undefined);
    }
  }
  return { layer, update: renderSimulation };
}
function drawEggs(g: Graphics, game: Game) {
  g.clear();
  const piles = new Map<string, number>();
  const spawnByEgg = new Map(game.spawns.map((entry) => [entry.eggId, entry]));
  for (const egg of [...game.items].sort((a, b) => a.id - b.id)) {
    if (egg.location.kind !== "cell") continue;
    const p = egg.location.cell;
    const x = (p.x + 0.5) * CELL;
    const y = SURFACE + (p.y + 0.5) * CELL;
    if (egg.kind === "food") {
      const id = cellKey(p);
      const stacked = piles.get(id) ?? 0;
      piles.set(id, stacked + egg.portions);
      if (stacked === 0) drawFoodPile(g, p.x * CELL, y, foodStock(game, id));
      continue;
    }
    g.ellipse(x, y + 7, 13, 4).fill({ color: 0x483921, alpha: 0.2 });
    for (const offset of [-7, 0, 7]) {
      g.ellipse(x + offset, y + (offset === 0 ? -2 : 2), 4, 6)
        .fill(0xf5e8bc)
        .stroke({ color: 0xc5ad75, width: 1 });
    }
    const spawn = spawnByEgg.get(egg.id);
    if (spawn) {
      g.roundRect(x - 16, y + 14, 32, 4, 1).fill(0x172c39);
      g.roundRect(x - 16, y + 14, 32 * spawn.progress, 4, 1).fill(roles[spawn.role].color);
    }
  }
  const queen = queenOf(game);
  if (!queen || queen.hp <= 0) return;
  const spot = position(queen);
  const x = spot.x * CELL + 10;
  const y = SURFACE + spot.y * CELL + 43;
  g.roundRect(x, y, CELL - 20, 3, 1).fill(0x695034);
  const progress = (game.eggTimer / EGG_SECONDS) * (CELL - 20);
  if (progress > 0) g.roundRect(x, y, progress, 3, 1).fill(0xf5e8bc);
}
function drawBlueprints(construction: Graphics, blueprints: Game["blueprints"]) {
  construction.clear();
  for (const [id, blueprint] of Object.entries(blueprints)) {
    const { x, y } = point(id);
    const px = x * CELL,
      py = SURFACE + y * CELL;
    const inset = blueprint.tile === "corridor" ? 18 : 5;
    construction
      .roundRect(px + inset, py + inset, CELL - inset * 2, CELL - inset * 2, 3)
      .fill({ color: 0x55bce9, alpha: 0.2 })
      .stroke({ color: 0x8cdaff, width: 1.5 });
    construction
      .rect(px + 6, py + 44, 40, 4)
      .fill(0x172c39)
      .rect(px + 6, py + 44, 40 * blueprint.progress, 4)
      .fill(0x8cdaff);
    for (let i = 0; i < Math.min(blueprint.workers, 8); i++)
      construction.circle(px + 7 + i * 5, py + 8, 1.5).fill(0xf1cd77);
  }
}
function drawAnt(sprite: Graphics, ant: Unit, time: number, carryingEgg: boolean, cargo?: FoodKind) {
  sprite.clear();
  if (ant.role === "queen") return;
  const { size } = roles[ant.role];
  const beetle = ant.role === "beetle";
  const spider = ant.role === "spider";
  const color = beetle || spider || ant.faction === "colony" ? roles[ant.role].color : 0xff7900;
  const moving = ant.route.length > 0 || (ant.role === "worker" && ant.working);
  for (const side of [-1, 1])
    for (let leg = 0; leg < (spider ? 4 : 3); leg++) {
      const swing = moving ? Math.sin(time * 15 + leg * 2 + side * 2) * 2 : 0;
      sprite
        .moveTo(-3 + leg * 3, 0)
        .lineTo(-7 + leg * 6 + swing, side * 5)
        .lineTo(-10 + leg * 9 + swing, side * 9)
        .stroke({ color, width: 1.5, cap: "round" });
    }
  if (spider) {
    sprite
      .ellipse(-9, 0, 9, 7)
      .fill(color)
      .stroke({ color: 0x211c2b, width: 1 })
      .circle(4, 0, 5)
      .fill(color)
      .stroke({ color: 0x211c2b, width: 1 });
    for (const eye of [-2, 2]) sprite.circle(7, eye, 1).fill(0xf0d38a);
    sprite.moveTo(8, -2).lineTo(13, -5).moveTo(8, 2).lineTo(13, 5).stroke({ color: 0x211c2b, width: 1.5 });
  } else {
    sprite
      .ellipse(-8, 0, 6, 4)
      .fill(color)
      .ellipse(0, 0, 4, 2.8)
      .fill(color)
      .circle(8, 0, ant.role === "warrior" ? 5 : 3.5)
      .fill(color);
  }
  if (beetle) {
    sprite
      .ellipse(-6, 0, 11, 8)
      .fill(color)
      .stroke({ color: 0x2b1d47, width: 1 })
      .moveTo(-17, 0)
      .lineTo(2, 0)
      .stroke({ color: 0x2b1d47, width: 1.2 });
  }
  if (!spider) {
    sprite.moveTo(10, -2).lineTo(15, -6).moveTo(10, 2).lineTo(15, 6).stroke({ color, width: 1.2 });
    sprite.circle(9, -1.5, 1).fill(0x241f1c);
  }
  if (ant.role === "worker") sprite.rect(-3, -3, 4, 6).fill(0xf3d581);
  if (carryingEgg) {
    for (const offset of [-4, 0, 4])
      sprite.ellipse(18, offset, 5, 3).fill(0xf5e8bc).stroke({ color: 0xc5ad75, width: 0.7 });
  }
  if (ant.role === "warrior")
    sprite.moveTo(11, -3).lineTo(15, -2).moveTo(11, 3).lineTo(15, 2).stroke({ color: 0xf4c1a3, width: 2 });
  if (beetle) sprite.moveTo(11, -4).lineTo(19, -7).moveTo(11, 4).lineTo(19, 7).stroke({ color: 0x2b1d47, width: 3 });
  if (cargo) drawScoutCargo(sprite, cargo);
  if (ant.hp < ant.maxHp) {
    sprite.roundRect(-7, -15, 14, 2.5, 1).fill(0x56382d);
    sprite.roundRect(-7, -15, (14 * ant.hp) / ant.maxHp, 2.5, 1).fill(0xa9df79);
  }
  sprite.scale.set(size);
  const p = position(ant);
  sprite.position.set((p.x + 0.5) * CELL, SURFACE + (p.y + 0.5) * CELL + ((ant.id % 3) - 1) * 3);
  sprite.rotation = ant.heading;
}

function drawFoodPile(g: Graphics, left: number, y: number, portions: number) {
  const ax = left + foodSlotX(0);
  g.ellipse(ax + 2, y + 8, 8, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  g.circle(ax, y + 1, 8)
    .fill(0x7da54c)
    .stroke({ color: 0x4f6e31, width: 1.2 });
  g.circle(ax - 3, y - 2, 2).fill({ color: 0xd8e6a3, alpha: 0.65 });
  g.moveTo(ax, y - 6)
    .lineTo(ax - 2, y - 11)
    .stroke({ color: 0x6f4c2c, width: 2, cap: "round" });
  g.ellipse(ax + 2, y - 9, 5, 2.5).fill(0x587d3d);
  if (portions < 2) return;
  const mx = left + foodSlotX(1);
  g.ellipse(mx, y + 9, 8, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  g.roundRect(mx - 3.5, y - 2, 7, 12, 3)
    .fill(0xe4c998)
    .stroke({ color: 0x9d744f, width: 1 });
  g.ellipse(mx, y - 4, 11, 7)
    .fill(0xc77852)
    .stroke({ color: 0x8f5038, width: 1.2 });
  for (const [dx, dy] of [
    [-5, -5],
    [1, -7],
    [5, -3],
  ] as const)
    g.circle(mx + dx, y + dy, 1.2).fill(0xf2d8a9);
  if (portions < 3) return;
  const cx = left + foodSlotX(2);
  g.ellipse(cx, y + 8, 12, 2.5).fill({ color: 0x483921, alpha: 0.2 });
  for (const [dx, dy] of [
    [-9, 2],
    [-3, 0],
    [3, 2],
  ] as const) {
    g.circle(cx + dx, y + dy, 4.5)
      .fill(0x8eae4e)
      .stroke({ color: 0x587431, width: 1 });
    g.moveTo(cx + dx - 1, y + dy + 4)
      .lineTo(cx + dx - 2, y + dy + 7)
      .stroke({ color: 0x587431, width: 1 });
  }
  g.circle(cx + 9, y, 5)
    .fill(0xa8c75e)
    .stroke({ color: 0x587431, width: 1 });
  g.circle(cx + 11, y - 1, 1).fill(0x2f3d1c);
}

function drawScoutCargo(g: Graphics, cargo: FoodKind) {
  if (cargo === "apple") {
    g.circle(21, 0, 8).fill(0x7da54c).stroke({ color: 0x4f6e31, width: 1.2 });
    g.circle(18, -3, 2).fill({ color: 0xd8e6a3, alpha: 0.65 });
    g.moveTo(21, -7).lineTo(19, -12).stroke({ color: 0x6f4c2c, width: 2, cap: "round" });
    g.ellipse(23, -10, 5, 2.5).fill(0x587d3d);
    return;
  }
  if (cargo === "mushroom") {
    g.roundRect(18, -1, 7, 12, 3).fill(0xe4c998).stroke({ color: 0x9d744f, width: 1 });
    g.ellipse(21.5, -4, 11, 7).fill(0xc77852).stroke({ color: 0x8f5038, width: 1.2 });
    for (const [x, y] of [
      [17, -5],
      [22, -7],
      [26, -3],
    ] as const)
      g.circle(x, y, 1.2).fill(0xf2d8a9);
    return;
  }
  const segments = [
    [17, 1],
    [22, -1],
    [27, 1],
    [32, -1],
  ] as const;
  for (const [x, y] of segments) {
    g.circle(x, y, 4.5).fill(0x8eae4e).stroke({ color: 0x587431, width: 1 });
    g.moveTo(x - 1, y + 4)
      .lineTo(x - 2, y + 7)
      .stroke({ color: 0x587431, width: 1 });
  }
  g.circle(36, 0, 5).fill(0xa8c75e).stroke({ color: 0x587431, width: 1 });
  g.circle(38, -1.5, 0.8).fill(0x302a26);
}
