import type { BuildTool, Tool } from "../game/colony";
import { buildSeconds } from "../game/construction";
import { roles } from "../game/rendering/appearance";
import type { SpawnBlock } from "../game/spawning";
import { STORAGE_SLOTS } from "../game/storage";
import { type SpawnRole, spawnCost } from "../game/units";
import { AntHead, FoodIcon } from "./icons";
import { spawnBlockLabel } from "./spawn-block";

type Props = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  blocks: Record<SpawnRole, SpawnBlock | null>;
  spawnAnt: (role: SpawnRole) => void;
};
const tools: Record<Tool, { label: string; title: string; description: string }> = {
  corridor: {
    label: "Коридор",
    title: "Коридор — продолжить проход",
    description: "Продолжай от коридора или начни сбоку от комнаты. Только коридоры ведут вниз.",
  },
  nest: {
    label: "Гнездо",
    title: "Гнездо — комната для яиц, до ×4",
    description: "Строй сбоку от коридора, расширяй до ×4. Здесь матка откладывает яйца, а рабочие хранят кладки.",
  },
  storage: {
    label: "Склад",
    title: `Склад — ${STORAGE_SLOTS} места для еды в каждой клетке, до ×4`,
    description: `Строй сбоку от коридора, расширяй до ×4. Каждая клетка хранит ${STORAGE_SLOTS} запаса еды.`,
  },
  demolish: {
    label: "Сломать",
    title: "Сломать край комнаты, коридора или чертежа",
    description: "Убирай крайние клетки, сохраняя комнаты и проходы.",
  },
};
function ToolIcon({ tool }: { tool: BuildTool }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="4" fill="#4a3c2e" />
      {tool === "corridor" ? (
        <>
          <path d="M19 4h10v15h15v10H29v15H19V29H4V19h15Z" fill="currentColor" />
          <path d="M22 5v17H5m38 4H26v17" fill="none" stroke="#fff3bd" strokeOpacity=".3" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="7" y="12" width="34" height="25" rx="4" fill="currentColor" />
          <path d="M3 22h5v8H3" fill="currentColor" />
          {tool === "nest" ? (
            <path d="M17 30a3 4 0 1 0 0-.1M24 28a3 4 0 1 0 0-.1M31 30a3 4 0 1 0 0-.1" fill="#fff3bd" fillOpacity=".7" />
          ) : (
            <path
              d="M11 33h26M15 21h6v8h-6zM21 21h6v8h-6zM27 21h6v8h-6z"
              fill="none"
              stroke="#fff3bd"
              strokeOpacity=".6"
              strokeWidth="2"
            />
          )}
        </>
      )}
    </svg>
  );
}
export function CommandPanel({ tool, setTool, blocks, spawnAnt }: Props) {
  return (
    <section className="command-panel" aria-label="Строительство">
      <div className="command-inner">
        <div className="command-title">
          <span>КОЛОНИЯ</span>
          <strong>Строительство</strong>
        </div>
        <div className="command-group">
          <span className="group-label" aria-hidden="true">
            СТРОИТЬ
          </span>
          <fieldset className="command-buttons" aria-label="Выбор постройки">
            {(["corridor", "nest", "storage"] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={`command-button ${tool === option ? "selected" : ""}`}
                aria-pressed={tool === option}
                title={tools[option].title}
                onClick={() => setTool(option)}
              >
                <ToolIcon tool={option} />
                <span>{tools[option].label}</span>
              </button>
            ))}
          </fieldset>
        </div>
        <div className="command-description">
          <strong>{tools[tool].label}</strong>
          <p>{tools[tool].description}</p>
          {tool !== "demolish" && (
            <small>
              <span className="chip">
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M6 3.4V6l1.8 1.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                {buildSeconds[tool]} с / рабочий
              </span>
              <span>Вместе быстрее</span>
            </small>
          )}
        </div>
        <button
          type="button"
          className={`command-button demolition ${tool === "demolish" ? "selected" : ""}`}
          onClick={() => setTool("demolish")}
          aria-pressed={tool === "demolish"}
          title={tools.demolish.title}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="m12 12 24 24m0-24L12 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <span>{tools.demolish.label}</span>
        </button>
        <Spawning blocks={blocks} spawnAnt={spawnAnt} />
      </div>
    </section>
  );
}

function Spawning({ blocks, spawnAnt }: Pick<Props, "blocks" | "spawnAnt">) {
  return (
    <div className="command-group recruitment">
      <span className="group-label" aria-hidden="true">
        ВЫВЕСТИ ИЗ ЯЙЦА
      </span>
      <fieldset className="command-buttons" aria-label="Выведение муравьёв">
        {(Object.keys(roles) as SpawnRole[]).map((role) => {
          const block = blocks[role];
          const title = `${roles[role].label} — ${block ? spawnBlockLabel[block] : `${spawnCost[role]} еды, яйцо и место в гнезде`}`;
          return (
            <button
              type="button"
              className="command-button"
              key={role}
              disabled={!!block}
              onClick={() => spawnAnt(role)}
              aria-label={title}
              title={title}
            >
              <AntHead antRole={role} />
              <span>{roles[role].label}</span>
              <span className="cost" aria-hidden="true">
                <FoodIcon />
                {spawnCost[role]}
              </span>
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
