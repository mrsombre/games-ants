import { Container, Graphics } from "pixi.js";
import { CELL, HEIGHT, GROUND as SURFACE, WIDTH } from "./layout";

const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
};

export function createLandscape() {
  const layer = new Container();
  const landscape = new Graphics();
  drawForest(landscape);
  drawGround(landscape);
  drawEntrance(landscape);
  layer.addChild(landscape);
  return layer;
}
function drawForest(landscape: Graphics) {
  landscape.rect(0, 0, WIDTH, SURFACE).fill(0xb4c6b6);
  landscape.circle(620, 64, 41).fill({ color: 0xf5eed3, alpha: 0.8 });
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 16; i++) {
      const x = i * 72 + random(i + layer * 20) * 55 - 30;
      const y = 38 + random(i + 80 * layer) * 100;
      const color = [0x8fae9f, 0x6f9483, 0x4d7664][layer];
      landscape.rect(x - 4 - layer, y, 9 + layer * 3, SURFACE - y).fill(color);
      landscape.ellipse(x, y + 12, 38 + layer * 8, 72).fill(color);
      landscape.ellipse(x - 24, y + 35, 27, 48).fill(color);
      landscape.ellipse(x + 24, y + 33, 28, 47).fill(color);
    }
  }
  landscape
    .moveTo(0, 235)
    .bezierCurveTo(180, 190, 300, 245, 460, 225)
    .bezierCurveTo(620, 205, 820, 205, WIDTH, 229)
    .lineTo(WIDTH, 270)
    .lineTo(0, 270)
    .closePath()
    .fill(0x365b43);
  for (const x of [70, 850]) {
    landscape
      .moveTo(x - 20, 260)
      .lineTo(x - 10, 20)
      .lineTo(x + 14, -10)
      .lineTo(x + 21, 260)
      .closePath()
      .fill(0x344e3b);
    landscape
      .moveTo(x, 116)
      .lineTo(x - 45, 55)
      .moveTo(x, 80)
      .lineTo(x + 45, 25)
      .stroke({ color: 0x344e3b, width: 12 });
    landscape.ellipse(x, 6, 132, 60).fill(0x2d533e);
  }
}
function drawGround(landscape: Graphics) {
  landscape.rect(0, SURFACE, WIDTH, HEIGHT - SURFACE).fill(0x302a26);
  landscape.rect(0, SURFACE, WIDTH, 13).fill(0x6d6543);
  for (let i = 0; i < 650; i++) {
    const x = random(i + 600) * WIDTH,
      y = SURFACE + 18 + random(i + 1600) * (HEIGHT - SURFACE);
    landscape.ellipse(x, y, 1 + random(i) * 2, 1).fill({ color: 0xa48b68, alpha: 0.16 });
  }
  for (let i = 0; i < 100; i++) {
    const x = i * 10;
    landscape
      .moveTo(x, 260)
      .lineTo(x - 3, 249 - random(i) * 10)
      .lineTo(x + 4, 258)
      .lineTo(x + 8, 245 - random(i + 1) * 6)
      .lineTo(x + 9, 263)
      .fill(0x78915a);
  }
}
function drawEntrance(landscape: Graphics) {
  const entranceX = 8.5 * CELL;
  landscape
    .moveTo(entranceX - 88, 260)
    .bezierCurveTo(entranceX - 60, 250, entranceX - 54, 209, entranceX - 10, 204)
    .bezierCurveTo(entranceX + 40, 200, entranceX + 54, 245, entranceX + 82, 260)
    .closePath()
    .fill(0x8b7350);
  for (let i = 0; i < 48; i++) {
    const x = entranceX - 45 + random(i + 70) * 90,
      y = 231 + random(i + 20) * 26;
    landscape
      .moveTo(x, y)
      .lineTo(x + 8, y - 4)
      .stroke({ color: 0xb59969, width: 2 });
  }
  landscape.ellipse(entranceX, 251, 14, 13).fill(0x302a26);
  for (const x of [167, 735, 778]) {
    landscape.roundRect(x, 248, 4, 12, 2).fill(0xded3a9);
    landscape.ellipse(x + 2, 248, 11, 5).fill(0xc98555);
  }
}
