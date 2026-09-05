import { Container, Graphics } from "pixi.js";
import { point } from "../colony";
import { type Ant, EGG_SECONDS, type Game, HOME, roles, type ScoutCargo } from "../model";
import { CELL, SURFACE } from "./layout";

export function createCreatures() {
  const layer = new Container();
  const construction = new Graphics();
  const eggs = new Graphics();
  const creatures = new Container();
  layer.addChild(construction, eggs, creatures);
  const sprites = new Map<number, Graphics>();
  function renderSimulation(game: Game, time: number) {
    drawBlueprints(construction, game.blueprints);
    drawEggs(eggs, game);
    for (const ant of game.ants) {
      let sprite = sprites.get(ant.id);
      if (!sprite) {
        sprite = new Graphics();
        sprites.set(ant.id, sprite);
        creatures.addChild(sprite);
      }
      sprite.visible = !(ant.role === "scout" && ant.phase === "away");
      if (!sprite.visible) continue;
      drawAnt(
        sprite,
        ant,
        time,
        game.eggs.some((egg) => "carrier" in egg.location && egg.location.carrier === ant.id),
      );
    }
  }
  return { layer, update: renderSimulation };
}
function drawEggs(g: Graphics, game: Game) {
  g.clear();
  for (const egg of game.eggs) {
    if (!("cell" in egg.location)) continue;
    const p = point(egg.location.cell);
    const x = (p.x + 0.5) * CELL;
    const y = SURFACE + (p.y + 0.5) * CELL;
    g.ellipse(x, y + 7, 13, 4).fill({ color: 0x483921, alpha: 0.2 });
    for (const offset of [-7, 0, 7]) {
      g.ellipse(x + offset, y + (offset === 0 ? -2 : 2), 4, 6)
        .fill(0xf5e8bc)
        .stroke({ color: 0xc5ad75, width: 1 });
    }
    const spawn = game.spawns.find((entry) => entry.eggId === egg.id);
    if (spawn) {
      g.roundRect(x - 16, y + 14, 32, 4, 1).fill(0x172c39);
      g.roundRect(x - 16, y + 14, 32 * spawn.progress, 4, 1).fill(roles[spawn.role].color);
    }
  }
  const x = HOME.x * CELL + 10;
  const y = SURFACE + HOME.y * CELL + 43;
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
function drawAnt(sprite: Graphics, ant: Ant, time: number, carryingEgg: boolean) {
  sprite.clear();
  const { color, size } = roles[ant.role];
  const moving = ant.route.length > 0 || (ant.role === "worker" && ant.working);
  for (const side of [-1, 1])
    for (let leg = 0; leg < 3; leg++) {
      const swing = moving ? Math.sin(time * 15 + leg * 2 + side * 2) * 2 : 0;
      sprite
        .moveTo(-3 + leg * 3, 0)
        .lineTo(-7 + leg * 6 + swing, side * 5)
        .lineTo(-10 + leg * 9 + swing, side * 9)
        .stroke({ color, width: 1.5, cap: "round" });
    }
  sprite
    .ellipse(-8, 0, 6, 4)
    .fill(color)
    .ellipse(0, 0, 4, 2.8)
    .fill(color)
    .circle(8, 0, ant.role === "warrior" ? 5 : 3.5)
    .fill(color);
  sprite.moveTo(10, -2).lineTo(15, -6).moveTo(10, 2).lineTo(15, 6).stroke({ color, width: 1.2 });
  sprite.circle(9, -1.5, 1).fill(0x241f1c);
  if (ant.role === "worker") sprite.rect(-3, -3, 4, 6).fill(0xf3d581);
  if (carryingEgg) {
    for (const offset of [-4, 0, 4])
      sprite.ellipse(18, offset, 5, 3).fill(0xf5e8bc).stroke({ color: 0xc5ad75, width: 0.7 });
  }
  if (ant.role === "warrior")
    sprite.moveTo(11, -3).lineTo(15, -2).moveTo(11, 3).lineTo(15, 2).stroke({ color: 0xf4c1a3, width: 2 });
  if (ant.role === "scout" && ant.cargo) drawScoutCargo(sprite, ant.cargo);
  sprite.scale.set(size);
  // Small per-ant offsets make workers sharing a site visible inside the passage.
  sprite.position.set((ant.x + 0.5) * CELL, SURFACE + (ant.y + 0.5) * CELL + ((ant.id % 3) - 1) * 3);
  sprite.rotation = ant.heading;
}

function drawScoutCargo(g: Graphics, cargo: ScoutCargo) {
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
