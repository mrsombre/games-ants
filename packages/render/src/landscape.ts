import autumn from "@app/assets/forests/autumn.svg?url";
import enchanted from "@app/assets/forests/enchanted.svg?url";
import summer from "@app/assets/forests/summer.svg?url";
import { dayPhase } from "@app/game/day-cycle";
import { Assets, Container, Graphics, Sprite } from "pixi.js";
import { CELL, GROUND, HEIGHT, HORIZON, WIDTH } from "./layout";

const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
};

const forests = [
  { source: summer, name: "Лесная поляна", sky: 0xe9eedc },
  { source: autumn, name: "Золотистый бор", sky: 0xf5e8ce },
  { source: enchanted, name: "Сумрачная долина", sky: 0xdce9e7 },
] as const;

export async function createLandscape() {
  const layer = new Container();
  const sky = new Graphics();
  const celestial = new Graphics();
  const lighting = new Graphics();
  const landscape = new Graphics();
  const design = forests[Math.floor(Math.random() * forests.length)] ?? forests[0];
  const forest = new Sprite(await Assets.load(design.source));
  const scale = Math.max(WIDTH / forest.texture.width, HORIZON / forest.texture.height);
  forest.scale.set(scale);
  forest.position.set((WIDTH - forest.width) / 2, (HORIZON - forest.height) * 0.35);
  const forestMask = new Graphics().rect(0, 0, WIDTH, HORIZON).fill(0xffffff);
  forest.mask = forestMask;
  drawGround(landscape);
  drawEntrance(landscape);
  layer.addChild(sky, celestial, forest, forestMask, lighting, landscape);
  let lastPhase = -1;
  function update(elapsedSeconds: number) {
    const phase = dayPhase(elapsedSeconds) % 4;
    if (phase === lastPhase) return;
    lastPhase = phase;
    const states = [
      { sky: 0xfff3cf, tint: 0xffffff, wash: 0xfff4cf, alpha: 0.16, x: 0.14, y: 0.34, light: 0xffdf88 },
      { sky: design.sky, tint: 0xffffff, wash: 0xffffff, alpha: 0, x: 0.5, y: 0.18, light: 0xfff1c2 },
      { sky: 0xefb3bd, tint: 0xedb2bd, wash: 0xe78ca9, alpha: 0.18, x: 0.86, y: 0.34, light: 0xffbd8d },
      { sky: 0x182c50, tint: 0x627da9, wash: 0x142b58, alpha: 0.3, x: 0.5, y: 0.25, light: 0xe4eeff },
    ];
    const state = states[phase];
    if (!state) return;
    sky.clear().rect(0, 0, WIDTH, HORIZON).fill(state.sky);
    forest.tint = state.tint;
    lighting.clear().rect(0, 0, WIDTH, HORIZON).fill({ color: state.wash, alpha: state.alpha });
    const x = WIDTH * state.x;
    const y = HORIZON * state.y;
    const radius = phase === 3 ? 24 : 32;
    celestial.clear();
    for (const [size, alpha] of [
      [1.9, 0.04],
      [1.5, 0.07],
      [1.2, 0.12],
    ] as const) {
      celestial.circle(x, y, radius * size).fill({ color: state.light, alpha });
    }
    celestial.circle(x, y, radius).fill(state.light);
    if (phase === 3) {
      celestial.circle(x - 8, y - 5, 5).fill({ color: 0xa4bbdb, alpha: 0.4 });
      celestial.circle(x + 7, y + 8, 7).fill({ color: 0xa4bbdb, alpha: 0.3 });
      celestial.circle(x + 9, y - 10, 3).fill({ color: 0xa4bbdb, alpha: 0.35 });
    }
  }
  update(0);
  return { layer, name: design.name, update };
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
