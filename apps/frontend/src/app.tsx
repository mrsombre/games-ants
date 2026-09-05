import { useEffect, useRef, useState } from "react";
import { type Colony, initialColony, isRoom, key, placementError, roomCount, type Tool } from "./game/colony";
import { createScene } from "./game/scene";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Awaited<ReturnType<typeof createScene>> | null>(null);
  const [colony, setColony] = useState<Colony>(() => ({ ...initialColony }));
  const [tool, setTool] = useState<Tool>("corridor");
  const [message, setMessage] = useState("Выбери клетку с плюсом — расширим наш дом!");
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const state = useRef({ colony, tool });
  state.current = { colony, tool };
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof createScene>> | undefined;
    void createScene(host.current, (x, y) => {
      const current = state.current;
      const reason = placementError(current.colony, x, y, current.tool);
      if (reason) {
        setMessage(reason);
        return;
      }
      const next = { ...current.colony, [key(x, y)]: current.tool };
      state.current = { ...current, colony: next };
      setColony(next);
      setMessage(
        current.tool === "room"
          ? isRoom(current.colony[key(x - 1, y)]) || isRoom(current.colony[key(x + 1, y)])
            ? "Комната стала просторнее!"
            : "Новая комната готова. Здесь будет уютно!"
          : "Коридор готов. Теперь можно копать дальше!",
      );
    })
      .then((result) => {
        instance = result;
        if (disposed) {
          result.destroy();
          return;
        }
        scene.current = result;
        result.render(state.current.colony, state.current.tool);
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      instance?.destroy();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.render(colony, tool);
  }, [colony, tool]);
  const rooms = roomCount(colony);
  const corridors = Object.values(colony).filter((tile) => tile === "corridor").length;
  function undo() {
    const positions = Object.keys(colony).filter((position) => !initialColony[position]);
    const last = positions.at(-1);
    if (!last) return;
    const next = { ...colony };
    delete next[last];
    setColony(next);
    setMessage("Последняя постройка отменена");
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
            <strong>{corridors}</strong>
            <span>Коридоры</span>
          </div>
          <div className="queen-stat">
            <span className="stat-icon">♛</span>
            <strong>1</strong>
            <span>матка</span>
          </div>
        </div>
        <span className="mode">
          <i /> Свободное строительство
        </span>
      </header>
      <section className="workspace">
        <div className="scene-panel">
          <div className="scene-heading">
            <span>
              <i /> Лесная поляна
            </span>
            <span>ПЕРВЫЙ МУРАВЕЙНИК</span>
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
            <span className="mouse-hint">ЛКМ · построить</span>
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
            <small>ЛКМ по клетке · Бесплатно</small>
          </div>
          <button
            type="button"
            className="undo"
            onClick={undo}
            disabled={Object.keys(colony).length === Object.keys(initialColony).length}
            title="Отменить последнюю постройку"
          >
            ↶ <span>Отменить</span>
          </button>
        </div>
      </section>
    </main>
  );
}
