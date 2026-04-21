import type { FuelMode, FuelName } from "../types";

const FUELS: { value: FuelName; label: string }[] = [
  { value: "Benzina", label: "Benzina" },
  { value: "Gasolio", label: "Gasolio" },
  { value: "GPL", label: "GPL" },
  { value: "Metano", label: "Metano" },
  { value: "HVO", label: "HVO" },
];

interface Props {
  fuel: FuelName;
  mode: FuelMode;
  radius: number;
  onChange: (patch: { fuel?: FuelName; mode?: FuelMode; radius?: number }) => void;
}

export function FuelFilter({ fuel, mode, radius, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Carburante
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {FUELS.map((f) => (
            <button
              key={f.value}
              onClick={() => onChange({ fuel: f.value })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                fuel === f.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Modalità
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["all", "self", "served"] as FuelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ mode: m })}
              className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-brand-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {m === "all" ? "Entrambi" : m === "self" ? "Self" : "Servito"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Raggio: {(radius / 1000).toFixed(1)} km
        </label>
        <input
          type="range"
          min={500}
          max={30000}
          step={500}
          value={radius}
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
          className="w-full mt-2 accent-brand-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>0.5 km</span>
          <span>15 km</span>
          <span>30 km</span>
        </div>
      </div>
    </div>
  );
}
