import type { Tool } from "../game/colony";
import { buildSeconds, type Role, roles } from "../game/model";

type Props = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  food: number;
  canUndo: boolean;
  undo: () => void;
  hire: (role: Role) => void;
};
export function CommandPanel({ tool, setTool, food, canUndo, undo, hire }: Props) {
  return (
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
          <small>{buildSeconds[tool]} с / рабочий · Вместе быстрее</small>
        </div>
        <button type="button" className="undo" onClick={undo} disabled={!canUndo} title="Отменить последний чертёж">
          ↶ <span>Отменить</span>
        </button>
        <Recruitment food={food} hire={hire} />
      </div>
    </section>
  );
}

function Recruitment({ food, hire }: Pick<Props, "food" | "hire">) {
  return (
    <fieldset className="command-buttons recruitment" aria-label="Найм муравьёв">
      {(Object.keys(roles) as Role[]).map((role) => (
        <button
          type="button"
          className="command-button"
          key={role}
          disabled={food < roles[role].cost}
          onClick={() => hire(role)}
          aria-label={`${roles[role].label} — ${roles[role].cost} еды`}
          title={`${roles[role].label} — ${roles[role].cost} еды`}
        >
          <svg viewBox="0 0 48 36" aria-hidden="true" style={{ color: `#${roles[role].color.toString(16)}` }}>
            <g
              transform={`translate(24 18) scale(${roles[role].size})`}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M-3 0l-8-7-5-4M0 0l0-9 4-4M3 0l10-6 5-5M-3 0l-8 7-5 4M0 0l0 9 4 4M3 0l10 6 5 5" fill="none" />
              <ellipse cx="-10" cy="0" rx="7" ry="5" />
              <ellipse cx="0" cy="0" rx="5" ry="3" />
              <circle cx="10" cy="0" r="5" />
              <path d="M13-2l7-5m-7 9 7 5" />
            </g>
          </svg>
          <span>{roles[role].label}</span>
          <small>{roles[role].cost} еды</small>
        </button>
      ))}
    </fieldset>
  );
}
