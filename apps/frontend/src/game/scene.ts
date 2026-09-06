import { Application, Graphics } from "pixi.js";
import { type Cell, isCell } from "./cells";
import { type Colony, placementError, type Tool } from "./colony";
import { plannedColony } from "./construction";
import { demolitionError } from "./demolition";
import type { Game } from "./model";
import { drawColony } from "./rendering/colony";
import { createCreatures } from "./rendering/creatures";
import { createLandscape } from "./rendering/landscape";
import { CELL, HEIGHT, SURFACE, screenCell, WIDTH } from "./rendering/layout";

export async function createScene(host: HTMLElement, onCellClick: (x: number, y: number) => void) {
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    background: "#a8bbb0",
    antialias: true,
    autoDensity: true,
    resolution: Math.min(devicePixelRatio, 2),
  });
  const tiles = new Graphics(),
    hover = new Graphics();
  const creatures = createCreatures();
  app.stage.addChild(createLandscape(), tiles, hover, creatures.layer);
  host.appendChild(app.canvas);
  let planned: Colony = {},
    tool: Tool = "corridor",
    revision = -1;
  let active: Cell | null = null;
  let currentGame: Game | undefined;
  function updateHover() {
    hover.clear();
    if (!active) return;
    const { x, y } = active;
    if (!isCell(x, y)) return;
    const valid =
      tool === "demolish" ? !!currentGame && !demolitionError(currentGame, x, y) : !placementError(planned, x, y, tool);
    hover
      .roundRect(x * CELL + 3, SURFACE + y * CELL + 3, CELL - 6, CELL - 6, 7)
      .fill({ color: valid ? 0xd8dd8d : 0xd98470, alpha: 0.28 })
      .stroke({ color: valid ? 0xe8ecac : 0xdf9a86, width: 2 });
  }
  const toCell = (event: PointerEvent): Cell => {
    const rect = app.canvas.getBoundingClientRect();
    return screenCell(
      ((event.clientX - rect.left) / rect.width) * WIDTH,
      ((event.clientY - rect.top) / rect.height) * HEIGHT,
    );
  };
  const move = (event: PointerEvent) => {
    active = toCell(event);
    updateHover();
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const { x, y } = toCell(event);
    onCellClick(x, y);
  };
  const leave = () => {
    active = null;
    updateHover();
  };
  app.canvas.addEventListener("pointermove", move);
  app.canvas.addEventListener("pointerdown", down);
  app.canvas.addEventListener("pointerleave", leave);
  app.canvas.setAttribute("aria-label", "Лес и подземная сетка муравейника. Выбери инструмент и нажми на клетку.");
  Object.assign(app.canvas.style, { width: "100%", height: "auto", display: "block" });
  return {
    update(game: Game, nextTool: Tool, time: number) {
      currentGame = game;
      if (revision !== game.revision || tool !== nextTool) {
        revision = game.revision;
        tool = nextTool;
        planned = plannedColony(game);
        drawColony(tiles, game.colony, planned, tool);
      }
      updateHover();
      creatures.update(game, time);
    },
    destroy() {
      app.canvas.removeEventListener("pointermove", move);
      app.canvas.removeEventListener("pointerdown", down);
      app.canvas.removeEventListener("pointerleave", leave);
      app.destroy(true, { children: true });
    },
  };
}
