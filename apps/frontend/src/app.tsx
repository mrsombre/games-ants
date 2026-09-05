import { roomCount } from "./game/colony";
import { CommandPanel } from "./ui/command-panel";
import { useGame } from "./ui/use-game";

export function App() {
  const { host, game, tool, setTool, message, error, ready, undo, hire } = useGame();
  const { colony, ants, food, blueprints } = game;
  const rooms = roomCount(colony);
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
              {ants.filter((ant) => ant.role === "scout" && ant.phase === "away").length}
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
      <CommandPanel
        tool={tool}
        setTool={setTool}
        ants={ants}
        food={food}
        canUndo={Object.keys(blueprints).length > 0}
        undo={undo}
        hire={hire}
      />
    </main>
  );
}
