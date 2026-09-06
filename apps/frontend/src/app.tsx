import { DAY_PHASES, dayPhase } from "./game/day-cycle";
import { queenOf } from "./game/model";
import { roles } from "./game/rendering/appearance";
import { nestCapacity, nestFree, type SpawnBlock, spawnBlock } from "./game/spawning";
import { foodStock, STORAGE_SLOTS } from "./game/storage";
import { type SpawnRole, spawnCost } from "./game/units";
import { CommandPanel } from "./ui/command-panel";
import { AntHead, EggIcon, FoodIcon, NestIcon } from "./ui/icons";
import { useGame } from "./ui/use-game";

export function App() {
  const { host, game, tool, setTool, message, tip, error, ready, landscapeName, spawnAnt } = useGame();
  const food = foodStock(game);
  const foodCapacity = Object.values(game.colony).filter((tile) => tile === "storage").length * STORAGE_SLOTS;
  const capacity = nestCapacity(game);
  const free = Math.max(0, nestFree(game));
  const blocks = Object.fromEntries(
    (Object.keys(spawnCost) as SpawnRole[]).map((role) => [role, spawnBlock(game, role)]),
  ) as Record<SpawnRole, SpawnBlock | null>;
  const ants = game.units.filter((unit) => unit.faction === "colony" && unit.role !== "queen");
  const eggs = game.items.filter((item) => item.kind === "egg").length;
  const enemies = game.units.filter((unit) => unit.faction === "raiders");
  const scoutsAway = ants.filter((ant) => ant.job?.kind === "forage" && ant.job.phase === "away");
  const phase = dayPhase(game.elapsedSeconds);
  const day = Math.floor(phase / DAY_PHASES.length) + 1;
  return (
    <main className="game">
      <header className="topbar">
        <section className="ant-counts" aria-label="Количество муравьёв">
          <div
            className="ant-count ant-total"
            role="img"
            title="Муравьёв всего"
            aria-label={`Муравьёв всего: ${ants.length}`}
          >
            <AntHead />
            <strong>{ants.length}</strong>
          </div>
          {(Object.keys(spawnCost) as SpawnRole[]).map((role) => {
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
          <div className="ant-count egg-count" role="img" title="Яйца" aria-label={`Яйца: ${eggs}`}>
            <EggIcon />
            <strong>{eggs}</strong>
          </div>
        </section>
        <section className="stats" aria-label="Ресурсы">
          <div
            role="img"
            aria-label={`Еда: вместимость ${foodCapacity}, сейчас ${food}`}
            title="Еда: вместимость хранилища / сейчас"
          >
            <FoodIcon className="resource-icon" />
            <strong data-testid="food">
              {foodCapacity} / {food}
            </strong>
          </div>
          <div role="img" aria-label={`Гнездо: всего ${capacity}, свободно ${free}`} title="Гнездо: всего / свободно">
            <NestIcon className="resource-icon" />
            <strong data-testid="nest">
              {capacity} / {free}
            </strong>
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
                  : landscapeName}
            </span>
            <span className="scene-status">
              <span className="scouts-away" role="img" aria-label={`В разведке: ${scoutsAway.length}`}>
                {scoutsAway.map((scout) => (
                  <AntHead antRole="scout" key={scout.id} />
                ))}
              </span>
              <span className="day-time">
                День {day}, {DAY_PHASES[phase % DAY_PHASES.length]}
              </span>
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
      <CommandPanel tool={tool} setTool={setTool} blocks={blocks} spawnAnt={spawnAnt} />
    </main>
  );
}
