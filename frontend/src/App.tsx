import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Moon, RefreshCw, Sun } from "lucide-react";
import { fetchStats, searchByPosition } from "./api";
import { StationsMap } from "./components/Map";
import { StationCard } from "./components/StationCard";
import { SearchBar } from "./components/SearchBar";
import { FuelFilter } from "./components/FuelFilter";
import { PriceStats } from "./components/PriceStats";
import { useGeolocation } from "./hooks/useGeolocation";
import { usePreferences } from "./hooks/usePreferences";
import type { Station, UserPreferences } from "./types";

const AUTO_REFRESH_MS = 60 * 60 * 1000;
const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 }; // Roma

function formatFreshness(iso?: string | null) {
  if (!iso) return { label: "—", tone: "bg-slate-400" };
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const hours = (now - ts) / 36e5;
  if (hours < 1) return { label: "Dati freschi", tone: "bg-emerald-500" };
  if (hours < 6) return { label: `${Math.round(hours)}h fa`, tone: "bg-amber-500" };
  return { label: `${Math.round(hours)}h fa`, tone: "bg-rose-500" };
}

export default function App() {
  const { prefs, update } = usePreferences();
  const { position, locate, loading: locating, error: geoError, setPosition } = useGeolocation();
  const [center, setCenter] = useState(prefs.lastPosition ?? DEFAULT_CENTER);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS);

  const handleFilterChange = useCallback(
    (patch: { fuel?: UserPreferences["favoriteFuel"]; mode?: UserPreferences["mode"]; radius?: number }) => {
      const { fuel, ...rest } = patch;
      update({ ...rest, ...(fuel !== undefined ? { favoriteFuel: fuel } : {}) });
    },
    [update],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (position) {
      setCenter({ lat: position.lat, lng: position.lng });
      update({ lastPosition: { lat: position.lat, lng: position.lng } });
    }
  }, [position, update]);

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 10 * 60 * 1000,
  });

  const searchQuery = useQuery({
    queryKey: ["search", center.lat, center.lng, prefs.radius],
    queryFn: () =>
      searchByPosition({
        lat: center.lat,
        lon: center.lng,
        radius: prefs.radius,
      }),
    refetchInterval: AUTO_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!searchQuery.dataUpdatedAt) return;
    setCountdown(AUTO_REFRESH_MS);
    const id = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [searchQuery.dataUpdatedAt]);

  const stations: Station[] = searchQuery.data?.results ?? [];

  const filteredStations = useMemo(() => {
    return stations
      .map((s) => ({
        ...s,
        fuels: s.fuels.filter((f) => {
          if (f.name !== prefs.favoriteFuel) return false;
          if (prefs.mode === "self" && !f.isSelf) return false;
          if (prefs.mode === "served" && f.isSelf) return false;
          return true;
        }),
      }))
      .filter((s) => s.fuels.length > 0)
      .sort((a, b) => {
        const pa = a.fuels[0]?.price ?? Infinity;
        const pb = b.fuels[0]?.price ?? Infinity;
        return pa - pb;
      });
  }, [stations, prefs.favoriteFuel, prefs.mode]);

  const avgPrice = useMemo(() => {
    const stat = statsQuery.data?.stats.find(
      (s) => s.fuel.toLowerCase() === prefs.favoriteFuel.toLowerCase(),
    );
    return stat?.avgSelf ?? stat?.avgServed ?? null;
  }, [statsQuery.data, prefs.favoriteFuel]);

  const fresh = formatFreshness(searchQuery.data?.source === "mise_api" ? new Date().toISOString() : statsQuery.data?.csvLastUpdate);
  const degradedMsg = searchQuery.data?.degraded ? searchQuery.data.message : null;
  const selectedStation = filteredStations.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm z-10">
        <h1 className="text-base sm:text-lg font-bold text-brand-700 dark:text-brand-500 shrink-0">
          Osservaprezzi
        </h1>
        <div className="flex-1 max-w-xl">
          <SearchBar
            onPick={(lat, lng) => {
              setCenter({ lat, lng });
              setPosition(null);
            }}
            onLocate={locate}
            locating={locating}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${fresh.tone}`} />
            {fresh.label}
          </span>
          <button
            onClick={() => searchQuery.refetch()}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            title={`Aggiorna (auto fra ${Math.floor(countdown / 60000)}m)`}
          >
            <RefreshCw className={`w-4 h-4 ${searchQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Tema"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {(degradedMsg || geoError) && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{geoError || degradedMsg}</span>
        </div>
      )}

      <div className="flex-1 relative flex overflow-hidden">
        <aside className="hidden md:flex flex-col w-[380px] border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <div className="p-3 space-y-3 border-b border-slate-200 dark:border-slate-700">
            <FuelFilter
              fuel={prefs.favoriteFuel}
              mode={prefs.mode}
              radius={prefs.radius}
              onChange={handleFilterChange}
            />
            {statsQuery.data && (
              <PriceStats
                stats={statsQuery.data.stats}
                highlightFuel={prefs.favoriteFuel}
                currentPrice={filteredStations[0]?.fuels[0]?.price ?? null}
              />
            )}
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{filteredStations.length} impianti</span>
              {searchQuery.isFetching && <span>Caricamento…</span>}
            </div>
            {filteredStations.length === 0 && !searchQuery.isFetching && (
              <div className="text-sm text-slate-500 text-center py-8">
                Nessun impianto trovato. Prova ad aumentare il raggio o cambiare carburante.
              </div>
            )}
            {filteredStations.map((s) => (
              <StationCard
                key={s.id}
                station={s}
                highlightFuel={prefs.favoriteFuel}
                mode={prefs.mode}
                onSelect={() => setSelectedId(s.id)}
                selected={selectedId === s.id}
                priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 relative">
          <StationsMap
            center={center}
            stations={filteredStations}
            highlightFuel={prefs.favoriteFuel}
            avgPrice={avgPrice}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </main>

        {/* Mobile bottom sheet */}
        <div
          className={`md:hidden absolute inset-x-0 bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-xl bottom-sheet ${
            sheetOpen ? "translate-y-0" : "translate-y-[calc(100%-96px)]"
          }`}
          style={{ maxHeight: "75vh" }}
        >
          <button
            onClick={() => setSheetOpen((o) => !o)}
            className="w-full flex flex-col items-center py-2"
          >
            <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="mt-1 text-sm font-medium">
              {filteredStations.length} impianti — {prefs.favoriteFuel}
            </span>
          </button>
          <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            <FuelFilter
              fuel={prefs.favoriteFuel}
              mode={prefs.mode}
              radius={prefs.radius}
              onChange={handleFilterChange}
            />
            {filteredStations.slice(0, 20).map((s) => (
              <StationCard
                key={s.id}
                station={s}
                highlightFuel={prefs.favoriteFuel}
                mode={prefs.mode}
                onSelect={() => setSelectedId(s.id)}
                selected={selectedId === s.id}
                priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedStation && (
        <div className="hidden md:block absolute bottom-4 right-4 w-[360px] z-10">
          <StationCard
            station={selectedStation}
            highlightFuel={prefs.favoriteFuel}
            mode={prefs.mode}
            selected
            priceBadge={priceBadge(selectedStation.fuels[0]?.price ?? null, avgPrice)}
          />
        </div>
      )}
    </div>
  );
}

function priceBadge(price: number | null, avg: number | null): "cheap" | "mid" | "expensive" | null {
  if (price == null || avg == null) return null;
  const diff = price - avg;
  if (diff <= -0.02) return "cheap";
  if (diff >= 0.02) return "expensive";
  return "mid";
}
