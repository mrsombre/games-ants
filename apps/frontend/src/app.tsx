import { useEffect, useRef, useState } from "react";
import { type Colony, initialColony, key, placementError, type Tool } from "./game/colony";
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
      const reason = placementError(current.colony, x, y);
      if (reason) {
        setMessage(reason);
        return;
      }
      const next = { ...current.colony, [key(x, y)]: current.tool };
      state.current = { ...current, colony: next };
      setColony(next);
      setMessage(
        current.tool === "room"
          ? "Новая комната готова. Здесь будет уютно!"
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
        result.render(state.current.colony);
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
    scene.current?.render(colony);
  }, [colony]);
  const rooms = Object.values(colony).filter((tile) => tile !== "corridor").length;
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
        <aside className="sidebar">
          <div>
            <p className="eyebrow">ТВОЯ ПЕРВАЯ КОЛОНИЯ</p>
            <h1>
              Дом под
              <br />
              лесом<span>.</span>
            </h1>
            <p className="intro">
              Большое приключение
              <br />
              начинается с маленькой норки.
            </p>
          </div>
          <div className="build-panel">
            <p className="section-label">ЧТО ПОСТРОИМ?</p>
            <button
              type="button"
              className={`build-card ${tool === "corridor" ? "selected" : ""}`}
              aria-pressed={tool === "corridor"}
              onClick={() => setTool("corridor")}
            >
              <span className="tile-icon corridor-icon">┼</span>
              <span>
                <strong>Коридор</strong>
                <small>Путь к новым комнатам</small>
              </span>
              <span className="selection-dot" />
            </button>
            <button
              type="button"
              className={`build-card ${tool === "room" ? "selected" : ""}`}
              aria-pressed={tool === "room"}
              onClick={() => setTool("room")}
            >
              <span className="tile-icon">▤</span>
              <span>
                <strong>Комната</strong>
                <small>Место для жизни и запасов</small>
              </span>
              <span className="selection-dot" />
            </button>
            <p className="free-note">Без стоимости · Можно экспериментировать</p>
          </div>
          <div className="hint">
            <span>✦</span>
            <p>
              <strong>Расти вглубь</strong>Нажми на пустую клетку рядом с муравейником. Комнаты соединяются
              автоматически.
            </p>
          </div>
          <button
            type="button"
            className="undo"
            onClick={undo}
            disabled={Object.keys(colony).length === Object.keys(initialColony).length}
          >
            ↶ Отменить последнюю постройку
          </button>
        </aside>
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
      <footer className="page-footer">
        <span>
          GAMES—ANTS <span> / </span> 01
        </span>
        <span>У каждого большого мира есть маленькое начало.</span>
        <span>ПРОТОТИП</span>
      </footer>
    </main>
  );
}
