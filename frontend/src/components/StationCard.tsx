import { Clock, ExternalLink, Fuel, MapPin, Star } from "lucide-react";
import type { FuelMode, Station } from "../types";

interface Props {
  station: Station;
  highlightFuel: string;
  mode: FuelMode;
  onSelect?: () => void;
  selected?: boolean;
  priceBadge?: "cheap" | "mid" | "expensive" | null;
  favorite?: boolean;
  onToggleFavorite?: (id: number) => void;
}

const KNOWN_BRANDS = new Set(
  [
    "eni",
    "agip",
    "agip eni",
    "q8",
    "esso",
    "ip",
    "api",
    "tamoil",
    "shell",
    "repsol",
    "total",
    "totalerg",
    "totalenergies",
    "erg",
    "beyfin",
    "keropetrol",
    "saras",
    "kuwait",
  ],
);

function displayLabels(station: Station): { primary: string; secondary: string | null } {
  const brand = (station.brand || "").trim();
  const name = (station.name || "").trim();
  const brandLow = brand.toLowerCase();
  const isGeneric = !brand || brandLow.includes("pompebianche") || brandLow === "senza logo";
  if (brand && !isGeneric && KNOWN_BRANDS.has(brandLow)) {
    return { primary: brand, secondary: name || null };
  }
  return { primary: name || brand || `Impianto ${station.id}`, secondary: !isGeneric ? brand : null };
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function StationCard({
  station,
  highlightFuel,
  mode,
  onSelect,
  selected,
  priceBadge,
  favorite,
  onToggleFavorite,
}: Props) {
  const { primary, secondary } = displayLabels(station);
  const addr = [station.address, station.municipality, station.province].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;

  const visibleFuels = station.fuels.filter((f) => {
    if (mode === "self" && !f.isSelf) return false;
    if (mode === "served" && f.isSelf) return false;
    return true;
  });
  const priced = visibleFuels.sort((a, b) => {
    if (a.name === highlightFuel && b.name !== highlightFuel) return -1;
    if (b.name === highlightFuel && a.name !== highlightFuel) return 1;
    return a.price - b.price;
  });

  const badgeColor =
    priceBadge === "cheap"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
      : priceBadge === "expensive"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
        : priceBadge === "mid"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          : null;

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-3 transition-colors cursor-pointer ${
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-700/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{primary}</h3>
            {secondary && (
              <span className="text-xs text-slate-500 shrink-0 truncate">{secondary}</span>
            )}
          </div>
          <div className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="truncate">{addr || "Indirizzo non disponibile"}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(station.id);
              }}
              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${
                favorite ? "text-amber-400" : "text-slate-300 dark:text-slate-500"
              }`}
              title={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
              aria-label="preferito"
            >
              <Star className="w-4 h-4" fill={favorite ? "currentColor" : "none"} />
            </button>
          )}
          {badgeColor && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${badgeColor}`}>
              {priceBadge === "cheap" ? "Economico" : priceBadge === "expensive" ? "Caro" : "Media"}
            </span>
          )}
          {station.distance != null && (
            <span className="text-xs text-slate-500">{station.distance.toFixed(2)} km</span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {priced.length === 0 && (
          <div className="text-xs text-slate-400 italic">Nessun prezzo per la modalità selezionata</div>
        )}
        {priced.map((f, idx) => (
          <div
            key={`${f.name}-${f.isSelf}-${idx}`}
            className={`flex items-center justify-between text-sm rounded px-2 py-1 ${
              f.name === highlightFuel
                ? "bg-brand-50 dark:bg-brand-700/20"
                : "bg-slate-50 dark:bg-slate-700/40"
            }`}
          >
            <span className="flex items-center gap-1 truncate">
              <Fuel className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="text-[10px] text-slate-400 uppercase">{f.isSelf ? "self" : "serv"}</span>
            </span>
            <span className="font-mono font-semibold tabular-nums">€ {f.price.toFixed(3)}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(station.insertDate) || "—"}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
        >
          Apri in Maps <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
