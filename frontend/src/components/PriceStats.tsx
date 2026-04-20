import { TrendingDown, TrendingUp } from "lucide-react";
import type { FuelStat } from "../types";

interface Props {
  stats: FuelStat[];
  highlightFuel: string;
  currentPrice?: number | null;
}

export function PriceStats({ stats, highlightFuel, currentPrice }: Props) {
  const fuelStat = stats.find((s) => s.fuel.toLowerCase() === highlightFuel.toLowerCase());
  const avg = fuelStat?.avgSelf ?? fuelStat?.avgServed ?? null;
  const delta = avg != null && currentPrice != null ? currentPrice - avg : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Media nazionale ({highlightFuel})</h3>
        {delta != null && (
          <span
            className={`text-xs font-medium flex items-center gap-1 ${
              delta <= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {delta <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(3)} €
          </span>
        )}
      </div>
      {avg != null ? (
        <div className="text-2xl font-bold tabular-nums">€ {avg.toFixed(3)}</div>
      ) : (
        <div className="text-sm text-slate-400">Dato non disponibile</div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {stats
          .filter((s) => s.fuel.toLowerCase() !== highlightFuel.toLowerCase())
          .slice(0, 4)
          .map((s) => {
            const v = s.avgSelf ?? s.avgServed;
            return (
              <div
                key={s.fuel}
                className="bg-slate-50 dark:bg-slate-700/40 rounded px-2 py-1 flex justify-between"
              >
                <span className="truncate">{s.fuel}</span>
                <span className="font-mono font-semibold">{v != null ? `€ ${v.toFixed(3)}` : "—"}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
