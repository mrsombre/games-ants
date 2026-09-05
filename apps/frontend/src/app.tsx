import { useEffect, useRef, useState } from "react";
import { roomCount, type Tool } from "./game/colony";
import { createScene } from "./game/scene";
import {
  cancelLastBlueprint,
  createGame,
  planBuild,
  plannedColony,
  type Role,
  recruit,
  roles,
  stepGame,
} from "./game/simulation";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Awaited<ReturnType<typeof createScene>> | null>(null);
  const game = useRef(createGame());
  const [, refresh] = useState(0);
  const [tool, setTool] = useState<Tool>("corridor");
  const currentTool = useRef(tool);
  currentTool.current = tool;
  const [message, setMessage] = useState("Поставь чертёж — рабочие сами начнут строить!");
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof createScene>> | undefined;
    let frame = 0;
    void createScene(host.current, (x, y) => {
      const reason = planBuild(game.current, x, y, currentTool.current);
      setMessage(reason ?? "Чертёж поставлен. Рабочие строят, когда к нему готов проход.");
      refresh((n) => n + 1);
    })
      .then((result) => {
        instance = result;
        if (disposed) {
          result.destroy();
          return;
        }
        scene.current = result;
        setReady(true);
        let last = performance.now(),
          accumulator = 0,
          uiTime = 0,
          revision = -1;
        let renderedTool: Tool | undefined;
        const tick = (now: number) => {
          // Pause in background; do not simulate hours on return to the tab.
          accumulator += Math.min((now - last) / 1000, 0.1);
          last = now;
          while (accumulator >= 0.05) {
            stepGame(game.current, 0.05);
            accumulator -= 0.05;
            uiTime += 0.05;
          }
          if (revision !== game.current.revision || renderedTool !== currentTool.current) {
            revision = game.current.revision;
            renderedTool = currentTool.current;
            result.render(game.current.colony, currentTool.current, plannedColony(game.current));
          }
          result.renderSimulation(game.current, now / 1000);
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
      scene.current = null;
    };
  }, []);
  const { colony, ants, food, blueprints } = game.current;
  const rooms = roomCount(colony);
  function undo() {
    cancelLastBlueprint(game.current);
    refresh((n) => n + 1);
    setMessage("Последний чертёж отменён");
  }
  function hire(role: Role) {
    setMessage(
      recruit(game.current, role) ? `${roles[role].label} появился у матки!` : "Не хватает еды — дождись разведчика",
    );
    refresh((n) => n + 1);
  }
  return (
    <main className="game">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Муравьи — главная">
          <img src="/ant.svg" alt="" />
          <span>
            муравьи<span className="brand-sub">МАЛЕНЬКИЙ БОЛЬШОЙ МИР</span>
          </span>
        </a>
        <div className="stats">
          <div>
            <span className="stat-icon">⌂</span>
            <strong>{rooms}</strong>
            <span>Комнаты</span>
          </div>
          <div>
            <span className="stat-icon">⋮</span>
            <strong data-testid="food">{food}</strong>
            <span>Еда</span>
          </div>
          <div className="queen-stat">
            <span className="stat-icon">♛</span>
            <strong>{ants.length}</strong>
            <span>Муравьи</span>
          </div>
        </div>
        <span className="mode">
          <i /> Колония живёт
        </span>
      </header>
      <section className="workspace">
        <div className="scene-panel">
          <div className="scene-heading">
            <span>
              <i /> Лесная поляна
            </span>
            <span>
              Чертежи: {Object.keys(blueprints).length} · В разведке:{" "}
              {ants.filter((ant) => ant.phase === "away").length}
            </span>
          </div>
          <div className="canvas-wrap">
            <div ref={host} />
            {!ready && (
              <div className="loading" role="status">
                {error ? "Не удалось открыть сцену. Попробуй обновить страницу." : "Просыпается лес…"}
              </div>
            )}
          </div>
          <div className="scene-footer">
            <span className="status" role="status">
              {message}
            </span>
            <span className="mouse-hint">ЛКМ · чертёж</span>
          </div>
        </div>
      </section>
      <section className="command-panel" aria-label="Строительство">
        <div className="command-inner">
          <div className="command-title">
            <span>КОЛОНИЯ</span>
            <strong>Строительство</strong>
          </div>
          <fieldset className="command-buttons" aria-label="Выбор постройки">
            <button
              type="button"
              className={`command-button ${tool === "corridor" ? "selected" : ""}`}
              aria-pressed={tool === "corridor"}
              title="Коридор — продолжить проход"
              onClick={() => setTool("corridor")}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <rect x="3" y="3" width="42" height="42" rx="4" fill="#4a3c2e" />
                <path d="M19 4h10v15h15v10H29v15H19V29H4V19h15Z" fill="currentColor" />
                <path d="M22 5v17H5m38 4H26v17" fill="none" stroke="#fff3bd" strokeOpacity=".3" strokeWidth="2" />
              </svg>
              <span>Коридор</span>
            </button>
            <button
              type="button"
              className={`command-button ${tool === "room" ? "selected" : ""}`}
              aria-pressed={tool === "room"}
              title="Комната — расширение по горизонтали до ×4"
              onClick={() => setTool("room")}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <rect x="3" y="3" width="42" height="42" rx="4" fill="#4a3c2e" />
                <rect x="7" y="12" width="34" height="25" rx="4" fill="currentColor" />
                <path d="M11 33h26M12 17h24" stroke="#fff3bd" strokeOpacity=".5" strokeWidth="2" />
                <path d="M3 22h5v8H3" fill="currentColor" />
              </svg>
              <span>Комната</span>
            </button>
          </fieldset>
          <div className="command-description">
            <strong>{tool === "corridor" ? "Коридор" : "Комната"}</strong>
            <p>
              {tool === "corridor"
                ? "Продолжай проход от другого коридора."
                : "Строй у коридора. Расширяй влево и вправо до ×4."}
            </p>
            <small>{tool === "corridor" ? "20" : "30"} с / рабочий · Вместе быстрее</small>
          </div>
          <button
            type="button"
            className="undo"
            onClick={undo}
            disabled={!Object.keys(blueprints).length}
            title="Отменить последний чертёж"
          >
            ↶ <span>Отменить</span>
          </button>
          <fieldset className="command-buttons recruitment" aria-label="Найм муравьёв">
            {(Object.keys(roles) as Role[]).map((role) => (
              <button
                type="button"
                className="command-button"
                key={role}
                disabled={food < roles[role].cost}
                onClick={() => hire(role)}
                aria-label={`${roles[role].label} — ${roles[role].cost} еды`}
                title={`${roles[role].label}: ${ants.filter((ant) => ant.role === role).length} в колонии`}
              >
                <svg viewBox="0 0 48 36" aria-hidden="true" style={{ color: `#${roles[role].color.toString(16)}` }}>
                  <g
                    transform={`translate(24 18) scale(${roles[role].size})`}
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M-3 0l-8-7-5-4M0 0l0-9 4-4M3 0l10-6 5-5M-3 0l-8 7-5 4M0 0l0 9 4 4M3 0l10 6 5 5"
                      fill="none"
                    />
                    <ellipse cx="-10" cy="0" rx="7" ry="5" />
                    <ellipse cx="0" cy="0" rx="5" ry="3" />
                    <circle cx="10" cy="0" r="5" />
                    <path d="M13-2l7-5m-7 9 7 5" />
                  </g>
                </svg>
                <span>{roles[role].label}</span>
                <small>
                  {roles[role].cost} еды · {ants.filter((ant) => ant.role === role).length} шт.
                </small>
              </button>
            ))}
          </fieldset>
        </div>
      </section>
    </main>
  );
}
