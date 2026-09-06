import { useEffect, useRef, useState } from "react";
import { SIMULATION_STEP } from "../game/model";
import { createScene } from "../game/scene";
import { createGame, stepGame } from "../game/simulation";
import { runLoggedCommand } from "../game/simulation-log";
import { startSpawn } from "../game/spawning";
import { applyTool, type Tool } from "../game/tools";
import type { SpawnRole } from "../game/units";
import { GAMEPLAY_TIP_INTERVAL, gameplayTips } from "./gameplay-tips";

export function useGame() {
  const host = useRef<HTMLDivElement>(null);
  const [game] = useState(createGame);
  const [, refresh] = useState(0);
  const [tool, setTool] = useState<Tool>("corridor");
  const currentTool = useRef(tool);
  currentTool.current = tool;
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [landscapeName, setLandscapeName] = useState("");
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof createScene>> | undefined;
    let frame = 0;
    void createScene(host.current, (x, y) => {
      const selectedTool = currentTool.current;
      const name = selectedTool === "demolish" ? "demolish" : "build";
      runLoggedCommand(game, "ui", name, { x, y, ...(selectedTool === "demolish" ? {} : { tile: selectedTool }) }, () =>
        applyTool(game, selectedTool, x, y),
      );
      refresh((n) => n + 1);
    })
      .then((result) => {
        instance = result;
        if (disposed) {
          result.destroy();
          return;
        }
        setLandscapeName(result.landscapeName);
        setReady(true);
        let last = performance.now(),
          accumulator = 0,
          uiTime = 0;
        const tick = (now: number) => {
          accumulator += Math.min((now - last) / 1000, 0.1);
          last = now;
          while (accumulator >= SIMULATION_STEP) {
            stepGame(game, SIMULATION_STEP);
            accumulator -= SIMULATION_STEP;
            uiTime += SIMULATION_STEP;
          }
          result.update(game, currentTool.current, now / 1000);
          if (uiTime >= 0.2) {
            refresh((n) => n + 1);
            uiTime = 0;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      instance?.destroy();
    };
  }, [game]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import("./dev-console").then((module) =>
      module.installDevConsole(game, () => refresh((n) => n + 1), console.info),
    );
  }, [game]);
  useEffect(() => {
    const interval = window.setInterval(
      () => setTipIndex((index) => (index + 1) % gameplayTips.length),
      GAMEPLAY_TIP_INTERVAL,
    );
    return () => window.clearInterval(interval);
  }, []);
  function spawnAnt(role: SpawnRole) {
    runLoggedCommand(game, "ui", "spawn", { role }, () => startSpawn(game, role));
    refresh((n) => n + 1);
  }
  return { host, game, tool, setTool, tip: gameplayTips[tipIndex], error, ready, landscapeName, spawnAnt };
}
