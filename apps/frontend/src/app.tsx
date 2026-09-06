import { queenOf } from "./game/model";
import { roles } from "./game/rendering/appearance";
import { spawnableEggs } from "./game/spawning";
import type { HatchRole } from "./game/units";
import { CommandPanel } from "./ui/command-panel";
import { AntHead, FoodIcon } from "./ui/icons";
import { useGame } from "./ui/use-game";

export function App() {
  const { host, game, tool, setTool, message, tip, error, ready, spawnAnt } = useGame();
  const { food } = game;
  const ants = game.units.filter((unit) => unit.faction === "colony" && unit.role !== "queen");
  const enemies = game.units.filter((unit) => unit.faction === "raiders");
  const scoutsAway = ants.filter((ant) => ant.job?.kind === "forage" && ant.job.phase === "away");
  return (
    <main className="game">
      <header className="topbar">
        <section className="ant-counts" aria-label="Муравьи по типам">
          {(Object.keys(roles) as HatchRole[]).map((role) => {
            const count = ants.filter((ant) => ant.role === role).length;
            return (
              <div
                className="ant-count"
                role="img"
                key={role}
                title={roles[role].label}
                aria-label={`${roles[role].label}: ${count}`}
              >
                <AntHead antRole={role} />
                <strong>{count}</strong>
              </div>
            );
          })}
        </section>
        <section className="stats" aria-label="Ресурсы">
          <div role="img" aria-label={`Еда: ${food}`} title="Еда">
            <FoodIcon className="resource-icon" />
            <strong data-testid="food">{food}</strong>
          </div>
        </section>
        <span className="latest-event" role="status" title={message}>
          <i /> {message}
        </span>
      </header>
      <section className="workspace">
        <div className="scene-panel">
          <div className="scene-heading">
            <span>
              <i />{" "}
              {(queenOf(game)?.hp ?? 0) <= 0
                ? "Королева погибла"
                : enemies.length
                  ? `Атака · врагов: ${enemies.length}`
                  : "Лесная поляна"}
            </span>
            <span className="scouts-away" role="img" aria-label={`В разведке: ${scoutsAway.length}`}>
              {scoutsAway.map((scout) => (
                <AntHead antRole="scout" key={scout.id} />
              ))}
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
            <span className="gameplay-tip">{tip}</span>
          </div>
        </div>
      </section>
      <CommandPanel
        tool={tool}
        setTool={setTool}
        food={food}
        hasEggSource={spawnableEggs(game).length > 0}
        spawnAnt={spawnAnt}
      />
    </main>
  );
}
