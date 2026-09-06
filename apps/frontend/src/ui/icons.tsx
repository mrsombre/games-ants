import { roles } from "../game/rendering/appearance";
import type { SpawnRole } from "../game/units";

export function FoodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 14c0-4-1-7-3-9" fill="none" stroke="#79513a" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 10c0-6 5-8 11-7-1 6-5 9-11 7Z" fill="#77934d" />
      <path d="M20 14C8 7 3 17 7 28c3 9 8 10 13 7 5 3 10 2 13-7 4-11-1-21-13-14Z" fill="#d95247" />
      <path d="M12 18c-2 2-2 5-1 7" fill="none" stroke="#f6a299" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EggIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="32" rx="14" ry="4" fill="#483921" fillOpacity=".2" />
      <ellipse cx="11" cy="24" rx="5" ry="8" fill="#f5e8bc" stroke="#c5ad75" strokeWidth="1.5" />
      <ellipse cx="29" cy="24" rx="5" ry="8" fill="#f5e8bc" stroke="#c5ad75" strokeWidth="1.5" />
      <ellipse cx="20" cy="19" rx="5.5" ry="9" fill="#f5e8bc" stroke="#c5ad75" strokeWidth="1.5" />
    </svg>
  );
}

export function NestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 5 4 19h5v15h22V19h5Z" fill="#c9a26b" />
      <path d="M20 5 4 19h5v15h22V19h5Z" fill="none" stroke="#79513a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 34V25a4 4 0 0 1 8 0v9" fill="#79513a" />
    </svg>
  );
}

export function AntHead({ antRole, className }: { antRole?: SpawnRole; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ color: antRole ? `#${roles[antRole].color.toString(16)}` : "#3c3026" }}
    >
      <path d="M14 17 10 9 5 6M26 17l4-8 5-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 13c-8 0-12 5-12 11 0 8 7 13 12 13s12-5 12-13c0-6-4-11-12-11Z" fill="currentColor" />
      <ellipse cx="13" cy="24" rx="2" ry="3" fill={antRole ? "#30392c" : "#f1d98c"} />
      <ellipse cx="27" cy="24" rx="2" ry="3" fill={antRole ? "#30392c" : "#f1d98c"} />
    </svg>
  );
}
