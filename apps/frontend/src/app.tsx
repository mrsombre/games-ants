import { type Role, roles } from "./game/model";
import { CommandPanel } from "./ui/command-panel";
import { useGame } from "./ui/use-game";

export function App() {
  const { host, game, tool, setTool, message, error, ready, hire } = useGame();
  const { ants, food, blueprints } = game;
  return (
    <main className="game">
      <header className="topbar">
        <section className="ant-counts" aria-label="Муравьи по типам">
          {(Object.keys(roles) as Role[]).map((role) => {
            const count = ants.filter((ant) => ant.role === role).length;
            return (
              <div
                className="ant-count"
                role="img"
                key={role}
                title={roles[role].label}
                aria-label={`${roles[role].label}: ${count}`}
              >
                <svg viewBox="0 0 40 40" aria-hidden="true" style={{ color: `#${roles[role].color.toString(16)}` }}>
                  <path
                    d="M14 17 10 9 5 6M26 17l4-8 5-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path d="M20 13c-8 0-12 5-12 11 0 8 7 13 12 13s12-5 12-13c0-6-4-11-12-11Z" fill="currentColor" />
                  <ellipse cx="13" cy="24" rx="2" ry="3" fill="#30392c" />
                  <ellipse cx="27" cy="24" rx="2" ry="3" fill="#30392c" />
                </svg>
                <strong>{count}</strong>
              </div>
            );
          })}
        </section>
        <section className="stats" aria-label="Ресурсы">
          <div role="img" aria-label={`Еда: ${food}`} title="Еда">
            <svg className="resource-icon" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M20 14c0-4-1-7-3-9" fill="none" stroke="#79513a" strokeWidth="3" strokeLinecap="round" />
              <path d="M21 10c0-6 5-8 11-7-1 6-5 9-11 7Z" fill="#77934d" />
              <path d="M20 14C8 7 3 17 7 28c3 9 8 10 13 7 5 3 10 2 13-7 4-11-1-21-13-14Z" fill="#d95247" />
              <path d="M12 18c-2 2-2 5-1 7" fill="none" stroke="#f6a299" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <strong data-testid="food">{food}</strong>
          </div>
        </section>
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
            <span className="mouse-hint">ЛКМ · {tool === "demolish" ? "сломать" : "чертёж"}</span>
          </div>
        </div>
      </section>
      <CommandPanel tool={tool} setTool={setTool} food={food} hire={hire} />
    </main>
  );
}
