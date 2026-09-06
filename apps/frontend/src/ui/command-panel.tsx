import type { Tool } from "../game/colony";
import { buildSeconds } from "../game/construction";
import { roles } from "../game/rendering/appearance";
import { type HatchRole, hatchCost } from "../game/units";
import { AntHead, FoodIcon } from "./icons";

type Props = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  food: number;
  hasEggSource: boolean;
  spawnAnt: (role: HatchRole) => void;
};
export function CommandPanel({ tool, setTool, food, hasEggSource, spawnAnt }: Props) {
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
        </div>
        <div className="command-description">
          <strong>{tool === "demolish" ? "Сломать" : tool === "corridor" ? "Коридор" : "Комната"}</strong>
          <p>
            {tool === "demolish"
              ? "Убирай крайние клетки, сохраняя комнаты и проходы."
              : tool === "corridor"
                ? "Продолжай от коридора или начни сбоку от комнаты. Только коридоры ведут вниз."
                : "Строй сбоку от коридора. Расширяй влево и вправо до ×4."}
          </p>
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
          title="Сломать край комнаты, коридора или чертежа"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="m12 12 24 24m0-24L12 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <span>Сломать</span>
        </button>
        <Spawning food={food} hasEggSource={hasEggSource} spawnAnt={spawnAnt} />
      </div>
    </section>
  );
}

function Spawning({ food, hasEggSource, spawnAnt }: Pick<Props, "food" | "hasEggSource" | "spawnAnt">) {
  return (
    <div className="command-group recruitment">
      <span className="group-label" aria-hidden="true">
        ВЫВЕСТИ ИЗ ЯЙЦА
      </span>
      <fieldset className="command-buttons" aria-label="Выведение муравьёв">
        {(Object.keys(roles) as HatchRole[]).map((role) => (
          <button
            type="button"
            className="command-button"
            key={role}
            disabled={food < hatchCost[role] || !hasEggSource}
            onClick={() => spawnAnt(role)}
            aria-label={`${roles[role].label} — ${hatchCost[role]} еды и яйцо`}
            title={`${roles[role].label} — ${hatchCost[role]} еды и яйцо`}
          >
            <AntHead antRole={role} />
            <span>{roles[role].label}</span>
            <span className="cost" aria-hidden="true">
              <FoodIcon />
              {hatchCost[role]}
            </span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}
