import { roles } from "@app/assets/appearance";
import { drawAnt } from "@app/assets/creatures";
import { drawFoodPile } from "@app/assets/food";
import { cellKey, point } from "@app/game/cells";
import { EGG_SECONDS } from "@app/game/eggs";
import { type Game, queenOf } from "@app/game/model";
import { position } from "@app/game/navigation";
import { foodStock } from "@app/game/storage";
import { present, type Unit } from "@app/game/units";
import { Container, Graphics } from "pixi.js";
import { foodSlotX } from "./colony";
import { CELL, SURFACE } from "./layout";

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
      drawAnt(queen, appearanceOf(queenUnit), time, false);
      queen.position.set(x + CELL / 2, y + CELL / 2 + 2);
      queen.rotation = queenUnit.heading;
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
      drawAnt(sprite, appearanceOf(ant), time, cargo?.kind === "egg", cargo?.kind === "food" ? cargo.food : undefined);
      const p = position(ant);
      sprite.position.set((p.x + 0.5) * CELL, SURFACE + (p.y + 0.5) * CELL + ((ant.id % 3) - 1) * 3);
      sprite.rotation = ant.heading;
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
      if (stacked === 0)
        drawFoodPile(
          g,
          [0, 1, 2].map((slot) => p.x * CELL + foodSlotX(slot)),
          y,
          foodStock(game, id),
        );
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

function appearanceOf(unit: Unit) {
  return {
    role: unit.role,
    faction: unit.faction,
    walking: unit.route.length > 0,
    working: unit.working,
    health: unit.hp / unit.maxHp,
  };
}
