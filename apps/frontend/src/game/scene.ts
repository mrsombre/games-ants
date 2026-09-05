import { Application, Container, Graphics, Text } from "pixi.js";
import { COLS, type Colony, key, placementError, ROWS, roomSpan, type Tool } from "./colony";

const CELL = 52;
const WIDTH = COLS * CELL;
const SURFACE = 260;
const HEIGHT = SURFACE + ROWS * CELL + 24;
const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
};

export async function createScene(host: HTMLElement, onBuild: (x: number, y: number) => void) {
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    background: "#a8bbb0",
    antialias: true,
    autoDensity: true,
    resolution: Math.min(devicePixelRatio, 2),
  });
  host.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);
  const landscape = new Graphics();
  world.addChild(landscape);
  landscape.rect(0, 0, WIDTH, SURFACE).fill(0xb4c6b6);
  landscape.circle(620, 64, 41).fill({ color: 0xf5eed3, alpha: 0.8 });
  // Layers of distant trees keep the forest readable behind the colony entrance.
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
  const tiles = new Container();
  world.addChild(tiles);
  const hover = new Graphics();
  world.addChild(hover);
  let colony: Colony = {};
  let tool: Tool = "corridor";
  let active: { x: number; y: number } | null = null;
  function updateHover() {
    hover.clear();
    if (!active) return;
    const { x, y } = active;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const valid = !placementError(colony, x, y, tool);
    hover
      .roundRect(x * CELL + 3, SURFACE + y * CELL + 3, CELL - 6, CELL - 6, 7)
      .fill({ color: valid ? 0xd8dd8d : 0xd98470, alpha: 0.28 })
      .stroke({ color: valid ? 0xe8ecac : 0xdf9a86, width: 2 });
  }
  function render(next: Colony, nextTool: Tool) {
    tool = nextTool;
    colony = next;
    for (const child of tiles.removeChildren()) child.destroy();
    const g = new Graphics();
    tiles.addChild(g);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const tile = colony[key(x, y)],
          px = x * CELL,
          py = SURFACE + y * CELL;
        if (!tile) {
          if (y === 0) continue;
          g.rect(px + 1, py + 1, CELL - 2, CELL - 2).stroke({ color: 0xa09170, alpha: 0.1, width: 1 });
          if (!placementError(colony, x, y, tool)) {
            g.roundRect(px + 5, py + 5, CELL - 10, CELL - 10, 7).fill({ color: 0xcac08e, alpha: 0.045 });
            g.moveTo(px + 23, py + 26)
              .lineTo(px + 29, py + 26)
              .moveTo(px + 26, py + 23)
              .lineTo(px + 26, py + 29)
              .stroke({ color: 0xc1b78c, alpha: 0.45, width: 1 });
          }
          continue;
        }
        const room = tile !== "corridor";
        const color = room ? 0x987546 : 0x796246;
        if (room) {
          const span = roomSpan(colony, x, y);
          if (x === span.left) {
            const width = span.width * CELL;
            g.roundRect(px + 4, py + 4, width - 8, CELL - 8, 9).fill(color);
            g.roundRect(px + 8, py + 8, width - 16, 33, 6).fill(0xac8c57);
            g.moveTo(px + 10, py + 43)
              .lineTo(px + width - 10, py + 43)
              .stroke({ color: 0xc2a36d, width: 2 });
          }
        } else g.roundRect(px + 18, py + 18, 16, 16, 5).fill(color);
        for (const [dx = 0, dy = 0] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (
            (colony[key(x + dx, y + dy)] && (tile === "corridor" || colony[key(x + dx, y + dy)] === "corridor")) ||
            (x === 8 && y === 0 && dy === -1)
          ) {
            if (room) {
              // Bridge only the room's outer margin; keep the passage out of its interior.
              g.rect(
                px + (dx < 0 ? 0 : dx > 0 ? CELL - 4 : 18),
                py + (dy < 0 ? 0 : dy > 0 ? CELL - 4 : 18),
                dx === 0 ? 16 : 4,
                dy === 0 ? 16 : 4,
              ).fill(0x796246);
            } else {
              g.rect(
                px + 18 + (dx < 0 ? -18 : 0),
                py + 18 + (dy < 0 ? -18 : 0),
                dx === 0 ? 16 : 34,
                dy === 0 ? 16 : 34,
              ).fill(color);
            }
          }
        if (room) {
          g.moveTo(px + 10, py + 43)
            .lineTo(px + 42, py + 43)
            .stroke({ color: 0xc2a36d, width: 2 });
          if (tile === "queen") {
            // Three jointed legs on each side of the thorax, visible in a slight top view.
            for (const side of [-1, 1]) {
              for (let leg = 0; leg < 3; leg++) {
                g.moveTo(px + 26 + leg * 2, py + 28)
                  .lineTo(px + 22 + leg * 6, py + 28 + side * 6)
                  .lineTo(px + 19 + leg * 9, py + 28 + side * 11)
                  .stroke({ color: 0x3c3026, width: 1.6, cap: "round", join: "round" });
              }
            }
            g.ellipse(px + 17, py + 28, 8, 5.5)
              .fill(0x3c3026)
              .ellipse(px + 28, py + 28, 5, 3.5)
              .fill(0x3c3026)
              .circle(px + 37, py + 28, 4.5)
              .fill(0x3c3026);
            g.moveTo(px + 39, py + 25)
              .lineTo(px + 42, py + 21)
              .lineTo(px + 46, py + 20)
              .moveTo(px + 40, py + 29)
              .lineTo(px + 44, py + 30)
              .lineTo(px + 46, py + 33)
              .stroke({ color: 0x3c3026, width: 1.4, cap: "round", join: "round" });
            g.circle(px + 38, py + 26, 1).fill(0xf1d98c);
            g.poly([px + 10, py + 11, px + 12, py + 17, px + 22, py + 17, px + 24, py + 11, px + 17, py + 14]).fill(
              0xf1d98c,
            );
          } else {
            for (let i = 0; i < 5; i++) g.ellipse(px + 15 + i * 5, py + 33 - (i % 2) * 5, 3, 4).fill(0xd6ba77);
          }
        }
      }
    updateHover();
  }
  const label = new Text({
    text: "ВХОД В МУРАВЕЙНИК",
    style: { fontFamily: "sans-serif", fontSize: 10, letterSpacing: 2, fill: 0xece8cc },
  });
  label.anchor.set(0.5);
  label.position.set(entranceX, 183);
  world.addChild(label);
  const toCell = (event: PointerEvent) => {
    const rect = app.canvas.getBoundingClientRect();
    return {
      x: Math.floor((((event.clientX - rect.left) / rect.width) * WIDTH) / CELL),
      y: Math.floor((((event.clientY - rect.top) / rect.height) * HEIGHT - SURFACE) / CELL),
    };
  };
  const move = (event: PointerEvent) => {
    active = toCell(event);
    updateHover();
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const { x, y } = toCell(event);
    onBuild(x, y);
  };
  const leave = () => {
    active = null;
    updateHover();
  };
  app.canvas.addEventListener("pointermove", move);
  app.canvas.addEventListener("pointerdown", down);
  app.canvas.addEventListener("pointerleave", leave);
  app.canvas.setAttribute(
    "aria-label",
    "Лес и подземная сетка муравейника. Выбери инструмент и нажми на соседнюю пустую клетку.",
  );
  app.canvas.style.width = "100%";
  app.canvas.style.height = "auto";
  app.canvas.style.display = "block";
  return {
    render,
    destroy: () => {
      app.canvas.removeEventListener("pointermove", move);
      app.canvas.removeEventListener("pointerdown", down);
      app.canvas.removeEventListener("pointerleave", leave);
      app.destroy(true, { children: true });
    },
  };
}
