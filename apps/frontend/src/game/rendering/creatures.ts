import { Container, Graphics } from "pixi.js";
import { point } from "../colony";
import { type Ant, type Game, roles } from "../model";
import { CELL, SURFACE } from "./layout";

export function createCreatures() {
  const layer = new Container();
  const construction = new Graphics();
  const creatures = new Container();
  layer.addChild(construction, creatures);
  const sprites = new Map<number, Graphics>();
  function renderSimulation(game: Game, time: number) {
    drawBlueprints(construction, game.blueprints);
    for (const ant of game.ants) {
      let sprite = sprites.get(ant.id);
      if (!sprite) {
        sprite = new Graphics();
        sprites.set(ant.id, sprite);
        creatures.addChild(sprite);
      }
      sprite.visible = !(ant.role === "scout" && ant.phase === "away");
      if (!sprite.visible) continue;
      drawAnt(sprite, ant, time);
    }
  }
  return { layer, update: renderSimulation };
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
function drawAnt(sprite: Graphics, ant: Ant, time: number) {
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
  if (ant.role === "warrior")
    sprite.moveTo(11, -3).lineTo(15, -2).moveTo(11, 3).lineTo(15, 2).stroke({ color: 0xf4c1a3, width: 2 });
  if (ant.role === "scout" && ant.cargo) sprite.ellipse(17, 0, 5, 3).fill(0xa7d767);
  sprite.scale.set(size);
  // Small per-ant offsets make workers sharing a site visible inside the passage.
  sprite.position.set((ant.x + 0.5) * CELL, SURFACE + (ant.y + 0.5) * CELL + ((ant.id % 3) - 1) * 3);
  sprite.rotation = ant.heading;
}
