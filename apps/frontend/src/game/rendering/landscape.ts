import { Assets, Container, Graphics, Sprite } from "pixi.js";
import autumn from "./forests/autumn.svg?url";
import enchanted from "./forests/enchanted.svg?url";
import summer from "./forests/summer.svg?url";
import { CELL, GROUND, HEIGHT, HORIZON, WIDTH } from "./layout";

const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
};

const forests = [
  { source: summer, name: "Лесная поляна" },
  { source: autumn, name: "Золотистый бор" },
  { source: enchanted, name: "Сумрачная долина" },
] as const;

export async function createLandscape() {
  const layer = new Container();
  const landscape = new Graphics();
  const design = forests[Math.floor(Math.random() * forests.length)] ?? forests[0];
  const forest = new Sprite(await Assets.load(design.source));
  const scale = Math.max(WIDTH / forest.texture.width, HORIZON / forest.texture.height);
  forest.scale.set(scale);
  forest.position.set((WIDTH - forest.width) / 2, HORIZON - forest.height);
  const forestMask = new Graphics().rect(0, 0, WIDTH, HORIZON).fill(0xffffff);
  forest.mask = forestMask;
  drawGround(landscape);
  drawEntrance(landscape);
  layer.addChild(forest, forestMask, landscape);
  return { layer, name: design.name };
}
function drawGround(landscape: Graphics) {
  landscape.rect(0, HORIZON, WIDTH, HEIGHT - HORIZON).fill(0x302a26);
  landscape.rect(0, HORIZON, WIDTH, 13).fill(0x6d6543);
  for (let i = 0; i < 650; i++) {
    const x = random(i + 600) * WIDTH,
      y = HORIZON + 18 + random(i + 1600) * (HEIGHT - HORIZON);
    landscape.ellipse(x, y, 1 + random(i) * 2, 1).fill({ color: 0xa48b68, alpha: 0.16 });
  }
  for (let i = 0; i < 100; i++) {
    const x = i * 10;
    landscape
      .moveTo(x, HORIZON)
      .lineTo(x - 3, HORIZON - 11 - random(i) * 10)
      .lineTo(x + 4, HORIZON - 2)
      .lineTo(x + 8, HORIZON - 15 - random(i + 1) * 6)
      .lineTo(x + 9, HORIZON + 3)
      .fill(0x78915a);
  }
}
function drawEntrance(landscape: Graphics) {
  const entranceX = 8.5 * CELL;
  landscape
    .moveTo(entranceX - 88, HORIZON + 6)
    .bezierCurveTo(entranceX - 60, HORIZON - 5, entranceX - 54, HORIZON - 47, entranceX - 10, HORIZON - 52)
    .bezierCurveTo(entranceX + 40, HORIZON - 56, entranceX + 54, HORIZON - 10, entranceX + 82, HORIZON + 6)
    .closePath()
    .fill(0x8b7350);
  for (let i = 0; i < 48; i++) {
    const x = entranceX - 45 + random(i + 70) * 90,
      y = HORIZON - 25 + random(i + 20) * 26;
    landscape
      .moveTo(x, y)
      .lineTo(x + 8, y - 4)
      .stroke({ color: 0xb59969, width: 2 });
  }
  landscape.rect(entranceX - 8, HORIZON - 9, 16, GROUND - HORIZON + 9).fill(0x796246);
  landscape.ellipse(entranceX, HORIZON - 9, 14, 13).fill(0x302a26);
}
